import assert from "node:assert/strict";
import test from "node:test";
import { BillingEventError, eventSubject, eventTime, planUpdateFor } from "./billingEvents.js";

const AT = new Date("2026-11-10T10:00:00Z");
const NEXT = "2026-12-10T10:00:00Z";
const ctx = { at: AT, productIntervals: { pdt_m: "monthly", pdt_y: "yearly" } };
const subEvent = (type, data = {}) => ({ type, timestamp: AT.toISOString(), data: { subscription_id: "sub_1", customer: { customer_id: "cus_1" }, product_id: "pdt_m", next_billing_date: NEXT, ...data } });

test("active / renewed / plan_changed: active status, access until next billing date, ids and interval stored", () => {
  for (const type of ["subscription.active", "subscription.renewed", "subscription.plan_changed"]) {
    const update = planUpdateFor(subEvent(type), { planStatus: "none" }, ctx);
    assert.equal(update.planStatus, "active");
    assert.equal(update.planAccessUntil.toISOString(), new Date(NEXT).toISOString());
    assert.equal(update.cancelAtPeriodEnd, false);
    assert.equal(update.planInterval, "monthly");
    assert.equal(update.billingCustomerId, "cus_1");
    assert.equal(update.billingSubscriptionId, "sub_1");
  }
});

test("only our configured Pro product ids can activate a subscription", () => {
  assert.equal(planUpdateFor(subEvent("subscription.active", { product_id: "pdt_y" }), {}, ctx).planInterval, "yearly");
  assert.equal(
    planUpdateFor(
      subEvent("subscription.active", { product_id: null, product_cart: [{ product_id: "pdt_y", quantity: 1 }] }),
      {},
      ctx
    ).planInterval,
    "yearly"
  );
  assert.throws(
    () => planUpdateFor(subEvent("subscription.active", { product_id: "other", payment_frequency_interval: "Year" }), {}, ctx),
    BillingEventError
  );
  assert.throws(() => planUpdateFor(subEvent("subscription.active", { product_id: null }), {}, ctx), BillingEventError);
});

test("an active event without a usable next billing date is a processing failure (Dodo retries)", () => {
  assert.throws(() => planUpdateFor(subEvent("subscription.active", { next_billing_date: null }), {}, ctx), BillingEventError);
  assert.throws(() => planUpdateFor(subEvent("subscription.renewed", { next_billing_date: "not a date" }), {}, ctx), BillingEventError);
});

test("on_hold and payment.failed: past_due for subscribers only, access date untouched", () => {
  for (const type of ["subscription.on_hold", "payment.failed"]) {
    assert.deepEqual(planUpdateFor({ type, data: {} }, { planStatus: "active" }, ctx), { planStatus: "past_due" });
    assert.deepEqual(planUpdateFor({ type, data: {} }, { planStatus: "cancelling" }, ctx), { planStatus: "past_due" });
    assert.equal(planUpdateFor({ type, data: {} }, { planStatus: "none" }, ctx), null);
    assert.equal(planUpdateFor({ type, data: {} }, { planStatus: "expired" }, ctx), null);
  }
});

test("cancelled at period end: cancelling while period or grace remains; expired once period and grace have passed", () => {
  const user = { planStatus: "active", planAccessUntil: new Date(NEXT) };
  const update = planUpdateFor(subEvent("subscription.cancelled", { cancel_at_next_billing_date: true }), user, ctx);
  assert.deepEqual(update, { planStatus: "cancelling", cancelAtPeriodEnd: true, billingSubscriptionId: "sub_1", billingCustomerId: "cus_1" });

  const longPast = new Date("2026-10-01T00:00:00Z");
  const ended = planUpdateFor(
    subEvent("subscription.cancelled", { cancel_at_next_billing_date: true, next_billing_date: null }),
    { planStatus: "cancelling", planAccessUntil: longPast },
    ctx
  );
  assert.equal(ended.planStatus, "expired");
  assert.equal(ended.cancelAtPeriodEnd, false);
  assert.equal(ended.planAccessUntil.toISOString(), longPast.toISOString());
});

test("subscription.updated handles portal cancel/resume and status transitions", () => {
  const user = { planStatus: "active", planAccessUntil: new Date(NEXT) };
  const portalCancel = planUpdateFor(subEvent("subscription.updated", { status: "active", cancel_at_next_billing_date: true }), user, ctx);
  assert.equal(portalCancel.planStatus, "cancelling");
  assert.equal(portalCancel.cancelAtPeriodEnd, true);
  assert.equal(portalCancel.planAccessUntil.toISOString(), new Date(NEXT).toISOString());

  const portalResume = planUpdateFor(subEvent("subscription.updated", { status: "active", cancel_at_next_billing_date: false }), { ...user, planStatus: "cancelling", cancelAtPeriodEnd: true }, ctx);
  assert.equal(portalResume.planStatus, "active");
  assert.equal(portalResume.cancelAtPeriodEnd, false);
});

test("cancelled immediately: expired, access ends at the event time", () => {
  const user = { planStatus: "active", planAccessUntil: new Date(NEXT) };
  const update = planUpdateFor(subEvent("subscription.cancelled", { cancel_at_next_billing_date: false }), user, ctx);
  assert.equal(update.planStatus, "expired");
  assert.equal(update.planAccessUntil.toISOString(), AT.toISOString());
  assert.equal(update.cancelAtPeriodEnd, false);
  assert.equal(update.billingSubscriptionId, "sub_1");
});

test("expired, full refund.succeeded and dispute.lost end access; partial refunds keep access; ending never extends an earlier end date", () => {
  for (const type of ["subscription.expired", "refund.succeeded", "dispute.lost"]) {
    const update = planUpdateFor({ type, data: {} }, { planStatus: "active", planAccessUntil: new Date(NEXT) }, ctx);
    assert.equal(update.planStatus, "expired");
    assert.equal(update.planAccessUntil.toISOString(), AT.toISOString());
  }
  assert.equal(
    planUpdateFor({ type: "refund.succeeded", data: { is_partial: true } }, { planStatus: "active", planAccessUntil: new Date(NEXT) }, ctx),
    null
  );
  assert.equal(
    planUpdateFor({ type: "refund.succeeded", data: { amount: 500, payment_amount: 1000 } }, { planStatus: "active", planAccessUntil: new Date(NEXT) }, ctx),
    null
  );
  const fullExplicit = planUpdateFor({ type: "refund.succeeded", data: { is_partial: false } }, { planStatus: "active", planAccessUntil: new Date(NEXT) }, ctx);
  assert.equal(fullExplicit.planStatus, "expired");
  const earlier = new Date("2026-11-01T00:00:00Z");
  const update = planUpdateFor({ type: "subscription.expired", data: {} }, { planStatus: "past_due", planAccessUntil: earlier }, ctx);
  assert.equal(update.planAccessUntil.toISOString(), earlier.toISOString());
  assert.equal(planUpdateFor({ type: "refund.succeeded", data: {} }, { planStatus: "none" }, ctx), null);
});

test("events that change nothing return null", () => {
  for (const type of ["subscription.failed", "payment.succeeded", "dispute.opened", "credit.added", "something.new"]) {
    assert.equal(planUpdateFor({ type, data: {} }, { planStatus: "active" }, ctx), null);
  }
});

test("payment.succeeded for a configured one-time yearly product (no subscription_id) activates Pro yearly for 365 days", () => {
  const update = planUpdateFor(
    {
      type: "payment.succeeded",
      timestamp: AT.toISOString(),
      data: {
        payment_id: "pay_y1",
        customer: { customer_id: "cus_y1" },
        product_cart: [{ product_id: "pdt_y", quantity: 1 }],
      },
    },
    { planStatus: "none" },
    ctx
  );
  assert.equal(update.planStatus, "active");
  assert.equal(update.planInterval, "yearly");
  assert.equal(update.billingCustomerId, "cus_y1");
  assert.equal(update.billingSubscriptionId, null);
  assert.equal(update.planAccessUntil.getTime(), AT.getTime() + 365 * 86_400_000);
});

test("eventSubject reads ids only; eventTime falls back to receipt time", () => {
  assert.deepEqual(eventSubject({ data: { metadata: { userId: "u1" }, subscription_id: "s", customer: { customer_id: "c" }, payment_id: "p" } }), { userId: "u1", subscriptionId: "s", customerId: "c", paymentId: "p" });
  assert.deepEqual(eventSubject({}), { userId: null, subscriptionId: null, customerId: null, paymentId: null });
  assert.equal(eventTime({ timestamp: AT.toISOString() }, 0).toISOString(), AT.toISOString());
  assert.equal(eventTime({ timestamp: "garbage" }, 5).getTime(), 5);
});
