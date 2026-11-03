// Webhook + checkout flow with in-memory stand-ins for the database and the Dodo client (no network, no secrets).
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { createCheckoutHandler, createWebhookHandler, processBillingEvent } from "./billingService.js";

const UID = "64b000000000000000000001";
const UID2 = "64b000000000000000000002";
const T1 = "2026-11-10T10:00:00Z";
const T2 = "2026-11-10T11:00:00Z";
const T3 = "2026-11-10T12:00:00Z";
const NEXT = "2026-12-10T10:00:00Z";

const query = (value) => ({ select() { return this; }, lean() { return this; }, then: (ok, fail) => Promise.resolve(value ? { ...value } : value).then(ok, fail) });

const makeStores = (users = {}) => {
  const db = { users, events: [], updates: 0 };
  const matches = (user, filter) =>
    String(user._id) === String(filter._id) &&
    filter.$or.some((cond) => {
      const last = user.billingLastEventAt ?? null;
      if (cond.billingLastEventAt === null) return last === null;
      if (cond.billingLastEventAt?.$exists === false) return !("billingLastEventAt" in user);
      return last !== null && new Date(last) < new Date(cond.billingLastEventAt.$lt);
    });
  const Users = {
    findById: (id) => query(db.users[String(id)] ?? null),
    findOne: ({ billingSubscriptionId }) => query(Object.values(db.users).find((u) => u.billingSubscriptionId === billingSubscriptionId) ?? null),
    updateOne: async (filter, { $set }) => {
      const user = db.users[String(filter._id)];
      if (!user || !matches(user, filter)) return { matchedCount: 0 };
      Object.assign(user, $set);
      db.updates += 1;
      return { matchedCount: 1 };
    },
  };
  const Events = {
    findOne: (filter) => query(db.events.find((e) =>
      (filter.eventId ? e.eventId === filter.eventId : e.paymentId === filter.paymentId && e.userId)
    ) ?? null),
    create: async (doc) => {
      if (db.events.some((e) => e.eventId === doc.eventId)) throw Object.assign(new Error("dup"), { code: 11000 });
      db.events.push({ ...doc });
    },
    findOneAndUpdate: async (filter, { $set }) => {
      const row = db.events.find((entry) =>
        entry.eventId === filter.eventId &&
        entry.state === filter.state &&
        (!entry.leaseUntil || new Date(entry.leaseUntil) <= new Date(filter.$or[0].leaseUntil.$lte))
      );
      if (!row) return null;
      Object.assign(row, $set);
      return row;
    },
    updateOne: async (filter, { $set, $unset }) => {
      const row = db.events.find((entry) =>
        entry.eventId === filter.eventId &&
        entry.state === filter.state &&
        entry.claimToken === filter.claimToken
      );
      if (!row) return { matchedCount: 0 };
      Object.assign(row, $set);
      for (const key of Object.keys($unset ?? {})) delete row[key];
      return { matchedCount: 1 };
    },
    deleteOne: async (filter) => {
      const index = db.events.findIndex((entry) =>
        entry.eventId === filter.eventId &&
        entry.state === filter.state &&
        entry.claimToken === filter.claimToken
      );
      if (index >= 0) db.events.splice(index, 1);
      return { deletedCount: index >= 0 ? 1 : 0 };
    },
  };
  return { db, deps: { User: Users, BillingEvent: Events, now: () => Date.parse(T3), productIntervals: { pdt_m: "monthly", pdt_y: "yearly" } } };
};

const newUser = (extra = {}) => ({ _id: UID, planStatus: "none", planAccessUntil: null, ...extra });
const event = (type, timestamp, data = {}) => ({ type, timestamp, data: { metadata: { userId: UID }, subscription_id: "sub_1", customer: { customer_id: "cus_1" }, product_id: "pdt_m", next_billing_date: NEXT, ...data } });

const fakeClient = () => ({ webhooks: { unwrap: (body, { headers }) => { if (headers["webhook-signature"] !== "v1,valid") throw new Error("bad signature"); return JSON.parse(body); } } });

const run = async (handler, req) => {
  const out = { status: null, body: null, error: null };
  const res = { status(code) { out.status = code; return this; }, json(body) { out.body = body; return this; } };
  await handler(req, res, (error) => { out.error = error; });
  return out;
};
const webhookReq = (ev, { id = "evt_1", signature = "v1,valid" } = {}) => {
  const headers = { "webhook-id": id, "webhook-signature": signature, "webhook-timestamp": "1" };
  return { body: Buffer.from(JSON.stringify(ev)), header: (name) => headers[name.toLowerCase()] };
};

let savedEnv;
beforeEach(() => {
  savedEnv = { ...process.env };
  process.env.DODO_PAYMENTS_WEBHOOK_KEY = "whsec_test";
  process.env.DODO_PRODUCT_PRO_MONTHLY = "pdt_m";
  process.env.DODO_PRODUCT_PRO_YEARLY = "pdt_y";
  process.env.APP_URL = "https://app.example.com/";
});
afterEach(() => {
  process.env = savedEnv;
});

const webhook = (stores) => createWebhookHandler({ getClient: async () => fakeClient(), deps: stores.deps });

/* ---------------- signature ---------------- */

test("a bad signature answers 401 and processes nothing", async () => {
  const stores = makeStores({ [UID]: newUser() });
  const out = await run(webhook(stores), webhookReq(event("subscription.active", T1), { signature: "v1,forged" }));
  assert.equal(out.error.statusCode, 401);
  assert.equal(stores.db.users[UID].planStatus, "none");
  assert.equal(stores.db.events.length, 0);
});

test("missing signature headers, a non-raw body and a missing webhook key are rejected", async () => {
  const stores = makeStores({ [UID]: newUser() });
  const noHeaders = { body: Buffer.from("{}"), header: () => undefined };
  assert.equal((await run(webhook(stores), noHeaders)).error.statusCode, 401);
  const parsed = { ...webhookReq(event("subscription.active", T1)), body: { already: "parsed" } };
  assert.equal((await run(webhook(stores), parsed)).error.statusCode, 400);
  delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  assert.equal((await run(webhook(stores), webhookReq(event("subscription.active", T1)))).error.statusCode, 503);
  assert.equal(stores.db.events.length, 0);
});

test("a valid signature is applied and answers 200", async () => {
  const stores = makeStores({ [UID]: newUser() });
  const out = await run(webhook(stores), webhookReq(event("subscription.active", T1)));
  assert.equal(out.status, 200);
  assert.equal(out.body.data.outcome, "applied");
  assert.equal(stores.db.users[UID].planStatus, "active");
});

/* ---------------- idempotency ---------------- */

test("the same webhook-id is processed once; the retry answers 200 and changes nothing", async () => {
  const stores = makeStores({ [UID]: newUser() });
  const handler = webhook(stores);
  await run(handler, webhookReq(event("subscription.active", T1), { id: "evt_a" }));
  stores.db.users[UID].planStatus = "past_due"; // something else changed the state in between
  const retry = await run(handler, webhookReq(event("subscription.active", T1), { id: "evt_a" }));
  assert.equal(retry.status, 200);
  assert.equal(retry.body.data.outcome, "duplicate");
  assert.equal(stores.db.users[UID].planStatus, "past_due");
  assert.equal(stores.db.events.length, 1);
  assert.equal(stores.db.updates, 1);
});

test("two copies racing in parallel leave one record and the same state", async () => {
  const stores = makeStores({ [UID]: newUser() });
  const handler = webhook(stores);
  const [a, b] = await Promise.all([
    run(handler, webhookReq(event("subscription.active", T1), { id: "evt_r" })),
    run(handler, webhookReq(event("subscription.active", T1), { id: "evt_r" })),
  ]);
  assert.deepEqual([a.status ?? a.error.statusCode, b.status ?? b.error.statusCode].sort(), [200, 500]);
  assert.equal(stores.db.events.length, 1);
  assert.equal(stores.db.users[UID].planStatus, "active");
  assert.equal(stores.db.updates, 1);
  const retry = await run(handler, webhookReq(event("subscription.active", T1), { id: "evt_r" }));
  assert.equal(retry.status, 200);
  assert.equal(retry.body.data.outcome, "duplicate");
});

test("an abandoned webhook claim is reclaimed after its lease expires", async () => {
  const stores = makeStores({ [UID]: newUser() });
  stores.db.events.push({
    eventId: "evt_abandoned",
    type: "subscription.active",
    state: "processing",
    claimToken: "old-claim",
    leaseUntil: new Date(T1),
  });
  assert.equal(await processBillingEvent(stores.deps, event("subscription.active", T2), "evt_abandoned"), "applied");
  assert.equal(stores.db.events.length, 1);
  assert.equal(stores.db.events[0].state, "processed");
  assert.equal(stores.db.events[0].claimToken, undefined);
});

test("a failed attempt is not recorded, so Dodo's retry is processed", async () => {
  const stores = makeStores({ [UID]: newUser() });
  const handler = webhook(stores);
  const failed = await run(handler, webhookReq(event("subscription.active", T1, { next_billing_date: null }), { id: "evt_f" }));
  assert.equal(failed.error.statusCode, 500);
  assert.equal(stores.db.events.length, 0);
  const retry = await run(handler, webhookReq(event("subscription.active", T1), { id: "evt_f" }));
  assert.equal(retry.status, 200);
  assert.equal(stores.db.users[UID].planStatus, "active");
});

test("a database failure answers 500 without leaking details", async () => {
  const stores = makeStores({ [UID]: newUser() });
  stores.deps.User.updateOne = async () => { throw new Error("mongo secret detail"); };
  const out = await run(webhook(stores), webhookReq(event("subscription.active", T1)));
  assert.equal(out.error.statusCode, 500);
  assert.ok(!out.error.message.includes("mongo"));
});

/* ---------------- out-of-order ---------------- */

test("an older event arriving late never overwrites a newer state", async () => {
  const stores = makeStores({ [UID]: newUser() });
  assert.equal(await processBillingEvent(stores.deps, event("subscription.renewed", T2), "e2"), "applied");
  assert.equal(await processBillingEvent(stores.deps, event("subscription.on_hold", T1), "e1"), "stale");
  assert.equal(stores.db.users[UID].planStatus, "active");
  assert.equal(stores.db.events.length, 2); // stale events are still recorded
});

test("when provider timestamps are equal, the first accepted billing event wins", async () => {
  const stores = makeStores({ [UID]: newUser() });
  assert.equal(await processBillingEvent(stores.deps, event("subscription.renewed", T1), "renewed"), "applied");
  assert.equal(await processBillingEvent(stores.deps, event("subscription.cancelled", T1), "cancelled"), "stale");
  assert.equal(stores.db.users[UID].planStatus, "active");
});

test("cancelled arriving before active (older active) keeps the newer cancellation", async () => {
  const stores = makeStores({ [UID]: newUser() });
  await processBillingEvent(stores.deps, event("subscription.cancelled", T2, { cancel_at_next_billing_date: true }), "c");
  assert.equal(await processBillingEvent(stores.deps, event("subscription.active", T1), "a"), "stale");
  assert.equal(stores.db.users[UID].planStatus, "cancelling");
  assert.equal(stores.db.users[UID].cancelAtPeriodEnd, true);
});

test("newer events keep applying in order", async () => {
  const stores = makeStores({ [UID]: newUser() });
  assert.equal(await processBillingEvent(stores.deps, event("subscription.active", T1), "1"), "applied");
  assert.equal(await processBillingEvent(stores.deps, event("subscription.on_hold", T2), "2"), "applied");
  assert.equal(stores.db.users[UID].planStatus, "past_due");
  assert.equal(await processBillingEvent(stores.deps, event("subscription.renewed", T3), "3"), "applied");
  assert.equal(stores.db.users[UID].planStatus, "active");
});

/* ---------------- state transitions end to end ---------------- */

test("full lifecycle: active -> past_due -> renewed -> cancelling -> expired", async () => {
  const stores = makeStores({ [UID]: newUser() });
  const user = stores.db.users[UID];
  await processBillingEvent(stores.deps, event("subscription.active", "2026-11-01T00:00:00Z"), "1");
  assert.deepEqual([user.planStatus, user.planInterval, user.billingSubscriptionId, user.billingCustomerId], ["active", "monthly", "sub_1", "cus_1"]);
  await processBillingEvent(stores.deps, event("payment.failed", "2026-11-02T00:00:00Z"), "2");
  assert.equal(user.planStatus, "past_due");
  assert.equal(new Date(user.planAccessUntil).toISOString(), new Date(NEXT).toISOString());
  await processBillingEvent(stores.deps, event("subscription.renewed", "2026-11-03T00:00:00Z", { next_billing_date: "2027-01-10T10:00:00Z" }), "3");
  assert.equal(user.planStatus, "active");
  assert.equal(new Date(user.planAccessUntil).toISOString(), "2027-01-10T10:00:00.000Z");
  await processBillingEvent(stores.deps, event("subscription.cancelled", "2026-11-04T00:00:00Z", { cancel_at_next_billing_date: true }), "4");
  assert.deepEqual([user.planStatus, user.cancelAtPeriodEnd], ["cancelling", true]);
  assert.equal(new Date(user.planAccessUntil).toISOString(), "2027-01-10T10:00:00.000Z");
  await processBillingEvent(stores.deps, event("subscription.expired", "2027-01-10T10:00:00Z"), "5");
  assert.equal(user.planStatus, "expired");
  assert.equal(new Date(user.planAccessUntil).toISOString(), "2027-01-10T10:00:00.000Z");
});

test("cancelled immediately ends access at the event time", async () => {
  const stores = makeStores({ [UID]: newUser({ planStatus: "active", billingSubscriptionId: "sub_1", planAccessUntil: new Date(NEXT) }) });
  await processBillingEvent(stores.deps, event("subscription.cancelled", T1, { cancel_at_next_billing_date: false }), "x");
  assert.equal(stores.db.users[UID].planStatus, "expired");
  assert.equal(new Date(stores.db.users[UID].planAccessUntil).toISOString(), new Date(T1).toISOString());
});

test("refund.succeeded and dispute.lost expire a subscriber, found through the payment when the event has no user id", async () => {
  for (const type of ["refund.succeeded", "dispute.lost"]) {
    const stores = makeStores({ [UID]: newUser() });
    await processBillingEvent(stores.deps, event("subscription.active", T1, { payment_id: "pay_1" }), "act");
    const lateEvent = { type, timestamp: T2, data: { payment_id: "pay_1" } }; // no metadata, no subscription id
    assert.equal(await processBillingEvent(stores.deps, lateEvent, `ev_${type}`), "applied");
    assert.equal(stores.db.users[UID].planStatus, "expired");
  }
});

test("the user is found by subscription id when the metadata is missing", async () => {
  const stores = makeStores({ [UID]: newUser({ planStatus: "active", billingSubscriptionId: "sub_1", planAccessUntil: new Date(NEXT) }) });
  const ev = { type: "subscription.on_hold", timestamp: T1, data: { subscription_id: "sub_1" } };
  assert.equal(await processBillingEvent(stores.deps, ev, "e"), "applied");
  assert.equal(stores.db.users[UID].planStatus, "past_due");
});

test("an unknown user answers 200, changes nothing and records only ids", async () => {
  const stores = makeStores({ [UID]: newUser() });
  const ev = event("subscription.active", T1, { metadata: { userId: "64b0000000000000000000ff" }, subscription_id: "sub_zzz" });
  const out = await run(webhook(stores), webhookReq(ev));
  assert.equal(out.status, 200);
  assert.equal(out.body.data.outcome, "no_user");
  assert.equal(stores.db.users[UID].planStatus, "none");
  assert.deepEqual(Object.keys(stores.db.events[0]).sort(), ["eventId", "paymentId", "processedAt", "state", "subscriptionId", "type", "userId"]);
});

test("one user's event never touches another user", async () => {
  const stores = makeStores({ [UID]: newUser(), [UID2]: newUser({ _id: UID2 }) });
  await processBillingEvent(stores.deps, event("subscription.active", T1), "e");
  assert.equal(stores.db.users[UID].planStatus, "active");
  assert.equal(stores.db.users[UID2].planStatus, "none");
});

test("subscription id binding takes precedence over mismatched metadata", async () => {
  const stores = makeStores({
    [UID]: newUser(),
    [UID2]: newUser({ _id: UID2, planStatus: "active", billingSubscriptionId: "sub_2" }),
  });
  const ev = event("subscription.renewed", T1, { subscription_id: "sub_2" });
  assert.equal(await processBillingEvent(stores.deps, ev, "mismatch"), "no_user");
  assert.equal(stores.db.users[UID].planStatus, "none");
  assert.equal(stores.db.users[UID2].planStatus, "active");
  assert.equal(stores.db.updates, 0);
});

test("metadata cannot replace an existing live subscription binding", async () => {
  const stores = makeStores({ [UID]: newUser({ planStatus: "active", billingSubscriptionId: "sub_old" }) });
  const ev = event("subscription.active", T1, { subscription_id: "sub_new" });
  assert.equal(await processBillingEvent(stores.deps, ev, "wrong-sub"), "no_user");
  assert.equal(stores.db.users[UID].billingSubscriptionId, "sub_old");
  assert.equal(stores.db.users[UID].planStatus, "active");
});

test("a verified first activation may bind a new subscription after the previous one expired", async () => {
  const stores = makeStores({ [UID]: newUser({ planStatus: "expired", billingSubscriptionId: "sub_old" }) });
  const ev = event("subscription.active", T1, { subscription_id: "sub_new" });
  assert.equal(await processBillingEvent(stores.deps, ev, "new-sub"), "applied");
  assert.equal(stores.db.users[UID].billingSubscriptionId, "sub_new");
  assert.equal(stores.db.users[UID].planStatus, "active");
});

test("a refund cannot revoke a replacement subscription using an old payment association", async () => {
  const stores = makeStores({ [UID]: newUser() });
  await processBillingEvent(stores.deps, event("subscription.active", T1, { payment_id: "pay_old", subscription_id: "sub_old" }), "old-active");
  stores.db.users[UID].planStatus = "expired";
  await processBillingEvent(stores.deps, event("subscription.active", T2, { subscription_id: "sub_new" }), "new-active");
  const refund = { type: "refund.succeeded", timestamp: T3, data: { payment_id: "pay_old", metadata: { userId: UID } } };
  assert.equal(await processBillingEvent(stores.deps, refund, "old-refund"), "no_user");
  assert.equal(stores.db.users[UID].billingSubscriptionId, "sub_new");
  assert.equal(stores.db.users[UID].planStatus, "active");
});

test("legacy payment associations without a subscription id cannot revoke a currently bound plan", async () => {
  const stores = makeStores({ [UID]: newUser({ planStatus: "active", billingSubscriptionId: "sub_current" }) });
  stores.db.events.push({ eventId: "legacy-payment", userId: UID, paymentId: "pay_legacy" });
  const refund = { type: "refund.succeeded", timestamp: T3, data: { payment_id: "pay_legacy" } };
  assert.equal(await processBillingEvent(stores.deps, refund, "legacy-refund"), "no_user");
  assert.equal(stores.db.users[UID].billingSubscriptionId, "sub_current");
  assert.equal(stores.db.users[UID].planStatus, "active");
});

/* ---------------- checkout ---------------- */

const checkout = (client) => createCheckoutHandler({ getClient: async () => client });
const recordingClient = () => {
  const calls = [];
  return { calls, checkoutSessions: { create: async (args) => { calls.push(args); return { checkout_url: "https://checkout.example.com/session/abc" }; } } };
};
const checkoutReq = (body, user = {}) => ({ body, user: { _id: UID, email: "a@b.com", fullname: "Ada", username: "ada", planStatus: "none", ...user } });

test("checkout maps the interval to OUR product id and takes the user from req.user", async () => {
  const client = recordingClient();
  const out = await run(checkout(client), checkoutReq({ interval: "yearly", productId: "pdt_evil", price: 1, plan: "pro", userId: UID2, product_cart: [{ product_id: "pdt_evil" }] }));
  assert.equal(out.status, 200);
  assert.deepEqual(out.body.data, { url: "https://checkout.example.com/session/abc" });
  assert.deepEqual(client.calls[0].product_cart, [{ product_id: "pdt_y", quantity: 1 }]);
  assert.deepEqual(client.calls[0].metadata, { userId: UID });
  assert.deepEqual(client.calls[0].customer, { email: "a@b.com", name: "Ada" });
  assert.equal(client.calls[0].return_url, "https://app.example.com/billing/success");
});

test("checkout rejects an unknown interval and refuses users who already subscribe", async () => {
  const client = recordingClient();
  for (const body of [{}, { interval: "weekly" }, { interval: ["monthly"] }, undefined]) {
    assert.equal((await run(checkout(client), checkoutReq(body))).error.statusCode, 400);
  }
  for (const planStatus of ["active", "cancelling", "past_due"]) {
    const out = await run(checkout(client), checkoutReq({ interval: "monthly" }, { planStatus }));
    assert.equal(out.error.statusCode, 409);
    assert.equal(out.error.code, "ALREADY_SUBSCRIBED");
  }
  assert.equal((await run(checkout(client), checkoutReq({ interval: "monthly" }, { planStatus: "expired" }))).status, 200);
  assert.equal(client.calls.length, 1);
});

test("checkout answers 503 when billing is not configured and 502 (no details) when the provider fails", async () => {
  delete process.env.DODO_PRODUCT_PRO_MONTHLY;
  assert.equal((await run(checkout(recordingClient()), checkoutReq({ interval: "monthly" }))).error.statusCode, 503);
  process.env.DODO_PRODUCT_PRO_MONTHLY = "pdt_m";
  assert.equal((await run(checkout(null), checkoutReq({ interval: "monthly" }))).error.statusCode, 503);
  const failing = { checkoutSessions: { create: async () => { throw Object.assign(new Error("secret provider payload"), { status: 500 }); } } };
  const out = await run(checkout(failing), checkoutReq({ interval: "monthly" }));
  assert.equal(out.error.statusCode, 502);
  assert.ok(!out.error.message.includes("secret"));
});
