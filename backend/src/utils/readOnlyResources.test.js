import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { assertOwnedResourceWritable, getReadOnlyResourceIds } from './readOnlyResources.js';

const previous = process.env.PLAN_ENFORCEMENT;
afterEach(() => {
  if (previous === undefined) delete process.env.PLAN_ENFORCEMENT;
  else process.env.PLAN_ENFORCEMENT = previous;
});

const modelFor = (rows) => ({
  find: () => ({
    sort: () => ({
      select: () => ({ lean: async () => rows }),
    }),
  }),
});

test('only resources after the entitlement count are read-only, oldest first', async () => {
  process.env.PLAN_ENFORCEMENT = 'all';
  const rows = [{ _id: 'oldest' }, { _id: 'newer' }, { _id: 'newest' }];
  const ids = await getReadOnlyResourceIds({ user: { _id: 'owner' }, Model: modelFor(rows), limitKey: 'maxJournals' });
  assert.deepEqual([...ids], ['newer', 'newest']);
});

test('unlimited entitlements never mark a resource read-only', async () => {
  process.env.PLAN_ENFORCEMENT = 'off';
  const ids = await getReadOnlyResourceIds({ user: { _id: 'owner' }, Model: modelFor([{ _id: 'one' }]), limitKey: 'maxJournals' });
  assert.equal(ids.size, 0);
});

test('write guard returns the required machine-readable PLAN_LIMIT feature', async () => {
  process.env.PLAN_ENFORCEMENT = 'all';
  await assert.rejects(
    assertOwnedResourceWritable({
      user: { _id: 'owner' },
      Model: modelFor([{ _id: 'oldest' }, { _id: 'locked' }]),
      resource: { _id: 'locked' },
      limitKey: 'maxJournals',
      feature: 'readonly_journal',
    }),
    (error) => error.statusCode === 403 && error.code === 'PLAN_LIMIT' && error.feature === 'readonly_journal'
  );
});


test('planner write guard uses its own feature key', async () => {
  process.env.PLAN_ENFORCEMENT = 'all';
  await assert.rejects(
    assertOwnedResourceWritable({
      user: { _id: 'owner' },
      Model: modelFor([{ _id: 'oldest' }, { _id: 'locked' }]),
      resource: { _id: 'locked' },
      limitKey: 'maxPlanners',
      feature: 'readonly_planner',
    }),
    (error) => error.statusCode === 403 && error.code === 'PLAN_LIMIT' && error.feature === 'readonly_planner'
  );
});

test('batch guard blocks an import that targets any locked journal and allows writable ones', async () => {
  process.env.PLAN_ENFORCEMENT = 'all';
  const { assertOwnedResourcesWritable } = await import('./readOnlyResources.js');
  const args = (resources) => ({ user: { _id: 'owner' }, Model: modelFor([{ _id: 'oldest' }, { _id: 'locked' }]), resources, limitKey: 'maxJournals', feature: 'readonly_journal' });
  await assertOwnedResourcesWritable(args([{ _id: 'oldest' }]));
  await assert.rejects(
    assertOwnedResourcesWritable(args([{ _id: 'oldest' }, { _id: 'locked' }])),
    (error) => error.statusCode === 403 && error.code === 'PLAN_LIMIT' && error.feature === 'readonly_journal'
  );
});
