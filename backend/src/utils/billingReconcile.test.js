import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconcileFilter, reconcileUser } from './billingReconcile.js';

const NOW = new Date('2026-11-03T00:00:00Z');
const NEXT = '2026-12-03T00:00:00Z';
const baseUser = () => ({
  _id: 'u1',
  billingSubscriptionId: 'sub_1',
  billingLastEventAt: new Date('2026-10-20T00:00:00Z'),
  planStatus: 'past_due',
  planAccessUntil: new Date('2026-11-01T00:00:00Z'),
  planInterval: 'monthly',
  cancelAtPeriodEnd: false,
});

// in-memory User: updateOne applies $set only when every filter field still equals the stored value
const fakeUsers = (stored) => {
  const writes = [];
  return {
    writes,
    updateOne: async (filter, change) => {
      writes.push({ filter, change });
      const same = Object.entries(filter).every(([key, value]) => {
        const have = stored[key] ?? null;
        const a = have instanceof Date ? have.getTime() : have;
        const b = value instanceof Date ? value.getTime() : value ?? null;
        return a === b;
      });
      if (!same) return { matchedCount: 0 };
      Object.assign(stored, change.$set);
      return { matchedCount: 1 };
    },
  };
};
const clientReturning = (subscription) => ({ subscriptions: { retrieve: async () => subscription } });
const activeSub = { status: 'active', next_billing_date: NEXT, cancel_at_next_billing_date: false };
const run = (stored, User, client, user = { ...stored }) => reconcileUser({ User, client, user, productIntervals: {}, now: () => NOW });

test('reconcile repairs state but never writes billingLastEventAt', async () => {
  const stored = baseUser();
  const User = fakeUsers(stored);
  assert.equal(await run(stored, User, clientReturning(activeSub)), 'changed');
  assert.equal(stored.planStatus, 'active');
  assert.equal(stored.planAccessUntil.toISOString(), '2026-12-03T00:00:00.000Z');
  assert.ok(!('billingLastEventAt' in User.writes[0].change.$set));
  assert.equal(stored.billingLastEventAt.toISOString(), '2026-10-20T00:00:00.000Z'); // unchanged, so a late valid webhook is still accepted
});

test('a webhook applied after the user was read wins: reconcile writes nothing', async () => {
  const stored = baseUser();
  const read = { ...stored };
  stored.planStatus = 'expired'; // webhook landed meanwhile
  stored.billingLastEventAt = new Date('2026-11-03T00:00:01Z');
  const User = fakeUsers(stored);
  assert.equal(await run(stored, User, clientReturning(activeSub), read), 'stale');
  assert.equal(stored.planStatus, 'expired');
});

test('an in-app cancel/resume after the read (no billingLastEventAt change) also wins', async () => {
  const stored = baseUser();
  const read = { ...stored };
  stored.planStatus = 'cancelling';
  stored.cancelAtPeriodEnd = true;
  const User = fakeUsers(stored);
  assert.equal(await run(stored, User, clientReturning(activeSub), read), 'stale');
  assert.equal(stored.planStatus, 'cancelling');
});

test('provider failure leaves local state untouched and does not write', async () => {
  const stored = baseUser();
  const before = { ...stored };
  const User = fakeUsers(stored);
  const client = { subscriptions: { retrieve: async () => { throw Object.assign(new Error('boom'), { status: 500 }); } } };
  await assert.rejects(run(stored, User, client));
  assert.equal(User.writes.length, 0);
  assert.deepEqual(stored, before);
});

test('an unusable active subscription (no next billing date) throws and writes nothing', async () => {
  const stored = baseUser();
  const User = fakeUsers(stored);
  await assert.rejects(run(stored, User, clientReturning({ status: 'active' })), { name: 'BillingEventError' });
  assert.equal(User.writes.length, 0);
});

test('identical state and unknown provider statuses are not written', async () => {
  const stored = { ...baseUser(), planStatus: 'active', planAccessUntil: new Date(NEXT) };
  const User = fakeUsers(stored);
  assert.equal(await run(stored, User, clientReturning(activeSub)), 'unchanged');
  assert.equal(await run(stored, User, clientReturning({ status: 'pending' })), 'unchanged');
  assert.equal(User.writes.length, 0);
});

test('legacy users with missing billing fields get a null-safe filter', () => {
  const filter = reconcileFilter({ _id: 'u2', billingSubscriptionId: 'sub_2' });
  assert.equal(filter.billingLastEventAt, null);
  assert.equal(filter.planStatus, null);
  assert.equal(filter.cancelAtPeriodEnd, null);
});
