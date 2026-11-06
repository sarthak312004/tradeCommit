// Cancel / resume / sync / portal state transitions with in-memory stand-ins for the database, the Dodo client and the mailer.
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { createBillingManageHandlers } from "./billingManage.js";
import { processBillingEvent } from "./billingService.js";
import { planUpdateForSubscription } from "./billingEvents.js";
import { rateLimit } from "../middlewares/rateLimit.middleware.js";

const UID = "64b000000000000000000001";
const NOW = Date.parse("2026-11-10T12:00:00Z");
const FUTURE = "2026-12-10T10:00:00Z";
const PAST = "2026-11-01T10:00:00Z";

const query = (value) => ({ select() { return this; }, lean() { return this; }, then: (ok, fail) => Promise.resolve(value ? { ...value } : value).then(ok, fail) });

let db, calls, emails, dodoFails, subscriptionOnDodo, portalLink;

const User = {
  findById: (id) => query(String(id) === UID ? db.user : null),
  updateOne: async (filter, { $set }) => {
    if (filter.planStatus?.$in && !filter.planStatus.$in.includes(db.user.planStatus)) return { matchedCount: 0 };
    if (filter.$or) {
      const last = db.user.billingLastEventAt ?? null;
      const ok = filter.$or.some((c) => (c.billingLastEventAt === null ? last === null : c.billingLastEventAt?.$exists === false ? !("billingLastEventAt" in db.user) : last !== null && new Date(last) <= new Date(c.billingLastEventAt.$lte)));
      if (!ok) return { matchedCount: 0 };
    }
    Object.assign(db.user, $set);
    return { matchedCount: 1 };
  },
};

const client = () => ({
  subscriptions: {
    update: async (id, body) => { calls.push(["update", id, body]); if (dodoFails) throw Object.assign(new Error("boom"), { status: 500 }); return { next_billing_date: FUTURE, cancel_at_next_billing_date: body.cancel_at_next_billing_date }; },
    retrieve: async (id) => { calls.push(["retrieve", id]); if (dodoFails) throw Object.assign(new Error("boom"), { status: 500 }); return subscriptionOnDodo; },
  },
  customers: { customerPortal: { create: async (id, params) => { calls.push(["portal", id, params]); if (dodoFails) throw new Error("boom"); return { link: portalLink }; } } },
});

const handlers = () => createBillingManageHandlers({ User, getClient: async () => client(), sendEmail: async (mail) => { emails.push(mail); return true; }, now: () => NOW });

const run = async (handler, req = {}) => {
  const out = { status: null, body: null, error: null };
  const res = { status(code) { out.status = code; return this; }, json(body) { out.body = body; return this; } };
  await handler({ user: { _id: UID }, body: {}, ...req }, res, (error) => { out.error = error; });
  return out;
};

beforeEach(() => {
  process.env.APP_URL = "https://app.example.com";
  process.env.PLAN_ENFORCEMENT = "all";
  process.env.DODO_PRODUCT_PRO_MONTHLY = "pdt_m";
  process.env.DODO_PRODUCT_PRO_YEARLY = "pdt_y";
  db = { user: { _id: UID, email: "a@b.co", fullname: "Asha", planStatus: "active", planAccessUntil: new Date(FUTURE), planInterval: "monthly", cancelAtPeriodEnd: false, billingCustomerId: "cus_1", billingSubscriptionId: "sub_1" } };
  calls = []; emails = []; dodoFails = false; portalLink = "https://pay.example.com/portal/x";
  subscriptionOnDodo = { status: "active", next_billing_date: FUTURE, cancel_at_next_billing_date: false };
});

/* status */
test("status returns the plan state without calling Dodo", async () => {
  const out = await run(handlers().status, { user: db.user });
  assert.equal(out.status, 200);
  assert.deepEqual(Object.keys(out.body.data).sort(), ["accessUntil", "cancelAtPeriodEnd", "interval", "plan", "status"]);
  assert.equal(out.body.data.status, "active");
  assert.equal(calls.length, 0);
});

/* cancel */
test("cancel schedules cancellation at period end: access is not ended now", async () => {
  const out = await run(handlers().cancel);
  assert.equal(out.status, 200);
  assert.deepEqual(calls, [["update", "sub_1", { cancel_at_next_billing_date: true }]]);
  assert.equal(db.user.planStatus, "cancelling");
  assert.equal(db.user.cancelAtPeriodEnd, true);
  assert.equal(new Date(db.user.planAccessUntil).toISOString(), new Date(FUTURE).toISOString());
  assert.equal(out.body.data.plan, "pro"); // still Pro
  assert.equal(emails.length, 1);
  assert.equal(emails[0].kind, "cancellation-scheduled");
});

test("cancel is idempotent: a second call does not hit Dodo or send another email", async () => {
  await run(handlers().cancel);
  calls = []; emails = [];
  const out = await run(handlers().cancel);
  assert.equal(out.status, 200);
  assert.equal(out.body.data.status, "cancelling");
  assert.equal(calls.length, 0);
  assert.equal(emails.length, 0);
});

test("cancel ignores any subscription id sent by the client", async () => {
  await run(handlers().cancel, { body: { subscriptionId: "sub_attacker", subscription_id: "sub_attacker" } });
  assert.equal(calls[0][1], "sub_1");
});

test("cancel without a subscription answers 409 and calls nothing", async () => {
  db.user.planStatus = "none"; db.user.billingSubscriptionId = null;
  const out = await run(handlers().cancel);
  assert.equal(out.error.statusCode, 409);
  assert.equal(out.error.code, "NO_SUBSCRIPTION");
  assert.equal(calls.length, 0);
});

test("cancel leaves state untouched when Dodo fails", async () => {
  dodoFails = true;
  const out = await run(handlers().cancel);
  assert.equal(out.error.statusCode, 502);
  assert.equal(db.user.planStatus, "active");
  assert.equal(db.user.cancelAtPeriodEnd, false);
  assert.equal(emails.length, 0);
});

test("cancel does not resurrect a plan a webhook just expired", async () => {
  const h = handlers();
  const originalUpdate = User.updateOne;
  User.updateOne = async (filter, change) => { db.user.planStatus = "expired"; return originalUpdate(filter, change); }; // webhook lands between read and write
  const out = await run(h.cancel);
  User.updateOne = originalUpdate;
  assert.equal(db.user.planStatus, "expired");
  assert.equal(emails.length, 0);
  assert.equal(out.status, 200);
});

/* resume */
test("resume undoes a scheduled cancellation inside the paid period", async () => {
  await run(handlers().cancel);
  calls = [];
  const out = await run(handlers().resume);
  assert.equal(out.status, 200);
  assert.deepEqual(calls, [["update", "sub_1", { cancel_at_next_billing_date: false }]]);
  assert.equal(db.user.planStatus, "active");
  assert.equal(db.user.cancelAtPeriodEnd, false);
});

test("resume on an active plan is a no-op", async () => {
  const out = await run(handlers().resume);
  assert.equal(out.status, 200);
  assert.equal(calls.length, 0);
});

test("resume after the paid period ended answers 409", async () => {
  db.user.planStatus = "cancelling"; db.user.cancelAtPeriodEnd = true; db.user.planAccessUntil = new Date(PAST);
  const out = await run(handlers().resume);
  assert.equal(out.error.statusCode, 409);
  assert.equal(out.error.code, "PERIOD_ENDED");
  assert.equal(calls.length, 0);
});

test("resume from past_due or expired answers 409", async () => {
  for (const planStatus of ["past_due", "expired", "none"]) {
    db.user.planStatus = planStatus;
    const out = await run(handlers().resume);
    assert.equal(out.error.statusCode, 409, planStatus);
  }
});

test("resume keeps 'cancelling' when Dodo fails", async () => {
  db.user.planStatus = "cancelling"; db.user.cancelAtPeriodEnd = true;
  dodoFails = true;
  const out = await run(handlers().resume);
  assert.equal(out.error.statusCode, 502);
  assert.equal(db.user.planStatus, "cancelling");
});

/* sync */
test("sync repairs a missed renewal", async () => {
  db.user.planAccessUntil = new Date(PAST); db.user.planStatus = "past_due";
  subscriptionOnDodo = { status: "active", next_billing_date: FUTURE, cancel_at_next_billing_date: false };
  const out = await run(handlers().sync);
  assert.equal(out.status, 200);
  assert.deepEqual(calls, [["retrieve", "sub_1"]]);
  assert.equal(db.user.planStatus, "active");
  assert.equal(new Date(db.user.planAccessUntil).toISOString(), new Date(FUTURE).toISOString());
});

test("sync binds a verified yearly subscription returned from checkout", async () => {
  db.user.planStatus = "cancelling";
  subscriptionOnDodo = {
    status: "active",
    subscription_id: "sub_yearly",
    product_id: "pdt_y",
    next_billing_date: FUTURE,
    cancel_at_next_billing_date: false,
    customer: { customer_id: "cus_1" },
  };
  const out = await run(handlers().sync, { body: { subscriptionId: "sub_yearly" } });
  assert.equal(out.status, 200);
  assert.equal(out.body.data.interval, "yearly");
  assert.equal(db.user.planInterval, "yearly");
  assert.equal(db.user.billingSubscriptionId, "sub_yearly");
  assert.deepEqual(calls, [["retrieve", "sub_yearly"]]);
});

test("sync refuses to bind a separate yearly subscription while monthly is still active", async () => {
  subscriptionOnDodo = {
    status: "active",
    subscription_id: "sub_yearly",
    product_id: "pdt_y",
    next_billing_date: FUTURE,
    cancel_at_next_billing_date: false,
    customer: { customer_id: "cus_1" },
  };
  const out = await run(handlers().sync, { body: { subscriptionId: "sub_yearly" } });
  assert.equal(out.error.statusCode, 409);
  assert.equal(out.error.code, "CANCEL_MONTHLY_FIRST");
  assert.equal(db.user.planInterval, "monthly");
  assert.equal(db.user.billingSubscriptionId, "sub_1");
});

test("sync picks up a cancellation made in the portal", async () => {
  subscriptionOnDodo = { status: "active", next_billing_date: FUTURE, cancel_at_next_billing_date: true };
  await run(handlers().sync);
  assert.equal(db.user.planStatus, "cancelling");
  assert.equal(db.user.cancelAtPeriodEnd, true);
});

test("sync picks up a resume made in the portal", async () => {
  db.user.planStatus = "cancelling"; db.user.cancelAtPeriodEnd = true;
  await run(handlers().sync);
  assert.equal(db.user.planStatus, "active");
  assert.equal(db.user.cancelAtPeriodEnd, false);
});

test("sync marks on_hold as past_due and an ended subscription as expired", async () => {
  subscriptionOnDodo = { status: "on_hold", next_billing_date: FUTURE };
  await run(handlers().sync);
  assert.equal(db.user.planStatus, "past_due");
  subscriptionOnDodo = { status: "cancelled", next_billing_date: PAST, cancel_at_next_billing_date: false };
  await run(handlers().sync);
  assert.equal(db.user.planStatus, "expired");
  assert.ok(new Date(db.user.planAccessUntil).getTime() <= NOW);
});

test("sync never extends access when ending a plan", () => {
  const update = planUpdateForSubscription({ status: "expired" }, { planStatus: "active", planAccessUntil: new Date(PAST) }, { at: new Date(NOW) });
  assert.equal(new Date(update.planAccessUntil).toISOString(), new Date(PAST).toISOString());
});

test("sync ignores unknown statuses and a user who never subscribed", async () => {
  subscriptionOnDodo = { status: "pending" };
  const out = await run(handlers().sync);
  assert.equal(out.status, 200);
  assert.equal(db.user.planStatus, "active");
  db.user.billingSubscriptionId = null; calls = [];
  await run(handlers().sync);
  assert.equal(calls.length, 0);
});

test("sync does not overwrite a newer applied webhook", async () => {
  db.user.billingLastEventAt = new Date(NOW + 60_000);
  db.user.planStatus = "cancelling";
  subscriptionOnDodo = { status: "active", next_billing_date: FUTURE, cancel_at_next_billing_date: false };
  await run(handlers().sync);
  assert.equal(db.user.planStatus, "cancelling");
});

test("sync answers 502 and changes nothing when Dodo fails", async () => {
  dodoFails = true;
  const out = await run(handlers().sync);
  assert.equal(out.error.statusCode, 502);
  assert.equal(db.user.planStatus, "active");
});

test("sync surfaces failed checkout-return lookups instead of reporting an unchanged plan", async () => {
  db.user.billingSubscriptionId = null;
  dodoFails = true;
  const out = await run(handlers().sync, { body: { subscriptionId: "sub_yearly" } });
  assert.equal(out.error.statusCode, 502);
  assert.equal(db.user.planStatus, "active");
});

test("sync answers 502 for an active subscription without a usable renewal date", async () => {
  subscriptionOnDodo = { status: "active", next_billing_date: null };
  const out = await run(handlers().sync);
  assert.equal(out.error.statusCode, 502);
});

/* portal */
test("portal uses the customer id from the user document and returns the link", async () => {
  const out = await run(handlers().portal, { body: { customer_id: "cus_attacker" } });
  assert.equal(out.body.data.url, portalLink);
  assert.deepEqual(calls, [["portal", "cus_1", { return_url: "https://app.example.com/billing" }]]);
});

test("portal without a customer answers 409; a non-https link is refused", async () => {
  portalLink = "http://insecure.example.com";
  assert.equal((await run(handlers().portal)).error.statusCode, 502);
  db.user.billingCustomerId = null;
  assert.equal((await run(handlers().portal)).error.code, "NO_CUSTOMER");
});

/* webhook emails */
const makeWebhookDeps = (user) => {
  const events = [];
  const notified = [];
  const BillingEvent = {
    findOne: (filter) => query(events.find((entry) =>
      filter.eventId ? entry.eventId === filter.eventId : entry.paymentId === filter.paymentId && entry.userId
    ) ?? null),
    create: async (doc) => {
      if (events.some((entry) => entry.eventId === doc.eventId)) throw Object.assign(new Error("duplicate"), { code: 11000 });
      events.push({ ...doc });
    },
    updateOne: async (filter, { $set, $unset }) => {
      const event = events.find((entry) => entry.eventId === filter.eventId && entry.claimToken === filter.claimToken);
      if (!event) return { matchedCount: 0 };
      Object.assign(event, $set);
      for (const key of Object.keys($unset ?? {})) delete event[key];
      return { matchedCount: 1 };
    },
    deleteOne: async (filter) => {
      const index = events.findIndex((entry) => entry.eventId === filter.eventId && entry.claimToken === filter.claimToken);
      if (index >= 0) events.splice(index, 1);
      return { deletedCount: index >= 0 ? 1 : 0 };
    },
  };
  return {
    notified,
    deps: {
      User: {
        findById: () => query(user),
        findOne: ({ billingSubscriptionId }) => query(user.billingSubscriptionId === billingSubscriptionId ? user : null),
        updateOne: async (f, { $set }) => { Object.assign(user, $set); return { matchedCount: 1 }; },
      },
      BillingEvent,
      notify: async (kind) => { notified.push(kind); },
      now: () => NOW,
      productIntervals: {},
    },
  };
};
const hook = (type, data = {}) => ({ type, timestamp: "2026-11-10T11:00:00Z", data: { metadata: { userId: UID }, subscription_id: "sub_1", next_billing_date: FUTURE, ...data } });

test("webhook: payment failure and downgrade each send one email, repeats do not", async () => {
  const user = { _id: UID, planStatus: "active", planAccessUntil: new Date(FUTURE), billingSubscriptionId: "sub_1" };
  const { deps, notified } = makeWebhookDeps(user);
  await processBillingEvent(deps, hook("subscription.on_hold"), "e1");
  await processBillingEvent(deps, hook("subscription.past_due"), "e2"); // already past_due: no second email
  await processBillingEvent(deps, hook("subscription.expired"), "e3");
  assert.deepEqual(notified, ["payment-failed", "downgrade-complete"]);
});

test("webhook: a failing mailer never fails the event", async () => {
  const user = { _id: UID, planStatus: "active", planAccessUntil: new Date(FUTURE), billingSubscriptionId: "sub_1" };
  const { deps } = makeWebhookDeps(user);
  deps.notify = async () => { throw new Error("mail down"); };
  assert.equal(await processBillingEvent(deps, hook("subscription.on_hold"), "e1"), "applied");
});

test("webhook: cancelled in the portal sends the scheduled email once; the in-app cancel (already 'cancelling') sends none", async () => {
  const user = { _id: UID, planStatus: "active", planAccessUntil: new Date(FUTURE), billingSubscriptionId: "sub_1" };
  const { deps, notified } = makeWebhookDeps(user);
  await processBillingEvent(deps, hook("subscription.cancelled", { cancel_at_next_billing_date: true }), "e1");
  assert.deepEqual(notified, ["cancellation-scheduled"]);
  await processBillingEvent(deps, hook("subscription.cancelled", { cancel_at_next_billing_date: true }), "e2");
  assert.equal(notified.length, 1);
});

/* per-user rate limit */
test("rateLimit can count per user instead of per IP", async () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 2, keyBy: (req) => req.user?._id });
  const hit = (user) => new Promise((resolve) => limiter({ ip: "1.1.1.1", user: { _id: user } }, { once() {}, locals: {}, setHeader() {} }, (error) => resolve(error ?? null)));
  assert.equal(await hit("a"), null);
  assert.equal(await hit("a"), null);
  assert.equal((await hit("a")).statusCode, 429);
  assert.equal(await hit("b"), null); // same IP, different user
});
