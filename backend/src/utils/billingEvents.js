// Pure rules: what a Dodo Payments webhook event does to a user's billing state. No database, no network.
// Webhooks only ever move planStatus / planAccessUntil and the billing ids; entitlements.js turns those into access.
//
//   subscription.active | renewed | plan_changed | updated -> 'active' (or 'cancelling'), planAccessUntil = next_billing_date
//   subscription.on_hold | past_due | payment.failed -> 'past_due' (access continues through the grace window)
//   subscription.cancelled (end of period)         -> 'cancelling', access unchanged (or 'expired' once period + grace has passed)
//   subscription.cancelled (immediately)           -> 'expired', access ends now
//   subscription.expired | refund.succeeded (full) | dispute.lost -> 'expired', access ends now
//
// Every result is a plain SET of values, so handling the same event twice leaves the same state.
import { GRACE_DAYS } from "../config/plans.config.js";

const DAY_MS = 86_400_000;
const LIVE_STATUSES = ["active", "cancelling", "past_due"];
const INTERVALS = ["monthly", "yearly"];

export class BillingEventError extends Error {
  constructor(message) {
    super(message);
    this.name = "BillingEventError";
  }
}

export const isLiveStatus = (status) => LIVE_STATUSES.includes(status);

const toDate = (value) => {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const cleanId = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** When the provider says the event happened (envelope `timestamp`); falls back to the time we received it. */
export const eventTime = (event, receivedAt = Date.now()) => toDate(event?.timestamp) ?? new Date(receivedAt);

/** Who and what the event is about, using ids only. */
export const eventSubject = (event) => {
  const data = event?.data ?? {};
  return {
    userId: cleanId(data.metadata?.userId),
    subscriptionId: cleanId(data.subscription_id),
    customerId: cleanId(data.customer?.customer_id),
    paymentId: cleanId(data.payment_id),
  };
};

export const extractProductId = (data) =>
  cleanId(data?.product_id) ??
  cleanId(data?.product?.product_id) ??
  cleanId(data?.product_cart?.[0]?.product_id);

const intervalOf = (data, productIntervals) => {
  const productId = extractProductId(data);
  const byProduct = productId ? productIntervals?.[productId] : null;
  if (INTERVALS.includes(byProduct)) return byProduct;
  const metaInterval = String(data?.metadata?.interval ?? "").toLowerCase();
  if (INTERVALS.includes(metaInterval)) return metaInterval;
  const frequency = String(data?.payment_frequency_interval ?? data?.billing_interval ?? "").toLowerCase();
  const count = Number(data?.payment_frequency_count ?? data?.billing_interval_count ?? 1);
  if (frequency === "year" || frequency === "yearly" || (frequency === "month" && count === 12)) return "yearly";
  if (frequency === "month" || frequency === "monthly") return "monthly";
  return null;
};

// Only product ids configured by us can activate Pro; provider-supplied metadata is not a product allowlist.
const configuredIntervalOf = (data, productIntervals) => {
  const productId = extractProductId(data);
  const interval = productId ? productIntervals?.[productId] : null;
  if (INTERVALS.includes(interval)) return interval;
  throw new BillingEventError("Subscription event has an unrecognized product");
};

const endAccessNow = (user, at) => {
  const current = toDate(user?.planAccessUntil);
  // never extend access by "ending" it: keep the earlier of the current end and the event time
  const until = current && current.getTime() < at.getTime() ? current : at;
  return { planStatus: "expired", planAccessUntil: until, cancelAtPeriodEnd: false };
};

const isPartialRefund = (data) =>
  data?.is_partial === true ||
  (Number.isFinite(Number(data?.amount)) &&
    Number.isFinite(Number(data?.payment_amount)) &&
    Number(data.amount) < Number(data.payment_amount));

const cancelledUpdate = (data, user, subject, at) => {
  if (data.cancel_at_next_billing_date === true) {
    const nextBilling = toDate(data.next_billing_date);
    const periodEnd = nextBilling ?? toDate(user?.planAccessUntil);
    if (periodEnd && periodEnd.getTime() + GRACE_DAYS * DAY_MS <= at.getTime()) {
      return {
        ...endAccessNow(user, at),
        ...(subject.subscriptionId ? { billingSubscriptionId: subject.subscriptionId } : {}),
        ...(subject.customerId ? { billingCustomerId: subject.customerId } : {}),
      };
    }
    const update = { planStatus: "cancelling", cancelAtPeriodEnd: true };
    if (!toDate(user?.planAccessUntil) && nextBilling) update.planAccessUntil = nextBilling;
    if (subject.subscriptionId) update.billingSubscriptionId = subject.subscriptionId;
    if (subject.customerId) update.billingCustomerId = subject.customerId;
    return update;
  }
  return {
    ...endAccessNow(user, at),
    ...(subject.subscriptionId ? { billingSubscriptionId: subject.subscriptionId } : {}),
    ...(subject.customerId ? { billingCustomerId: subject.customerId } : {}),
  };
};

/**
 * Returns the fields to $set on the user, or null when the event changes nothing.
 * Throws BillingEventError when a paid event cannot be applied (the webhook then answers 500 so Dodo retries).
 * @param {object} event          verified webhook event ({ type, timestamp, data })
 * @param {object} user           current user fields (planStatus, planAccessUntil ...)
 * @param {{ at: Date, productIntervals?: Record<string,string> }} context
 */
export const planUpdateFor = (event, user, { at, productIntervals } = {}) => {
  const data = event?.data ?? {};
  const subject = eventSubject(event);

  switch (event?.type) {
    case "subscription.active":
    case "subscription.renewed":
    case "subscription.plan_changed": {
      const nextBilling = toDate(data.next_billing_date ?? data.current_period_end ?? data.expires_at);
      if (!nextBilling) throw new BillingEventError("Subscription event has no usable next billing date");
      const update = {
        planStatus: data.cancel_at_next_billing_date === true ? "cancelling" : "active",
        planAccessUntil: nextBilling,
        cancelAtPeriodEnd: data.cancel_at_next_billing_date === true,
      };
      update.planInterval = configuredIntervalOf(data, productIntervals);
      if (subject.customerId) update.billingCustomerId = subject.customerId;
      if (subject.subscriptionId) update.billingSubscriptionId = subject.subscriptionId;
      return update;
    }

    case "subscription.updated": {
      const status = String(data.status ?? "active").toLowerCase();
      if (status === "on_hold" || status === "past_due") {
        return isLiveStatus(user?.planStatus) ? { planStatus: "past_due" } : null;
      }
      if (status === "cancelled") return cancelledUpdate(data, user, subject, at);
      if (status === "expired") {
        return isLiveStatus(user?.planStatus) || toDate(user?.planAccessUntil) ? endAccessNow(user, at) : null;
      }
      if (status !== "active") return null;
      const nextBilling = toDate(data.next_billing_date ?? data.current_period_end ?? data.expires_at) ?? toDate(user?.planAccessUntil);
      if (!nextBilling) throw new BillingEventError("Subscription event has no usable next billing date");
      const update = {
        planStatus: data.cancel_at_next_billing_date === true ? "cancelling" : "active",
        planAccessUntil: nextBilling,
        cancelAtPeriodEnd: data.cancel_at_next_billing_date === true,
      };
      if (extractProductId(data) && Object.keys(productIntervals ?? {}).length > 0) {
        update.planInterval = configuredIntervalOf(data, productIntervals);
      } else {
        const interval = intervalOf(data, productIntervals);
        if (interval) update.planInterval = interval;
      }
      if (subject.customerId) update.billingCustomerId = subject.customerId;
      if (subject.subscriptionId) update.billingSubscriptionId = subject.subscriptionId;
      return update;
    }

    case "payment.succeeded": {
      // One-time product payment (no subscription_id) for a configured Pro product activates Pro for that interval.
      if (subject.subscriptionId) return null;
      const productId = extractProductId(data);
      const interval = productId ? productIntervals?.[productId] : null;
      if (!INTERVALS.includes(interval)) return null;
      const durationDays = interval === "yearly" ? 365 : 30;
      const nextBilling =
        toDate(data.next_billing_date ?? data.current_period_end ?? data.expires_at) ??
        new Date(at.getTime() + durationDays * DAY_MS);
      const update = {
        planStatus: "active",
        planAccessUntil: nextBilling,
        cancelAtPeriodEnd: false,
        planInterval: interval,
        billingSubscriptionId: null,
      };
      if (subject.customerId) update.billingCustomerId = subject.customerId;
      return update;
    }

    case "subscription.on_hold":
    case "subscription.past_due":
    case "payment.failed":
      // only a subscriber can fall behind; a failed first payment of a free user changes nothing
      return isLiveStatus(user?.planStatus) ? { planStatus: "past_due" } : null;

    case "subscription.cancelled":
      return cancelledUpdate(data, user, subject, at);

    case "refund.succeeded":
      if (isPartialRefund(data)) return null;
      return isLiveStatus(user?.planStatus) || toDate(user?.planAccessUntil) ? endAccessNow(user, at) : null;

    case "subscription.expired":
    case "dispute.lost":
      return isLiveStatus(user?.planStatus) || toDate(user?.planAccessUntil) ? endAccessNow(user, at) : null;

    default:
      return null; // subscription.failed, payment.succeeded, dispute.opened ... are recorded but change nothing
  }
};

/**
 * Same idea as planUpdateFor, but from a subscription fetched from Dodo (POST /billing/sync) instead of an event.
 * Returns the fields to $set, or null when there is nothing to change. Throws BillingEventError when an active
 * subscription has no usable next billing date.
 * Statuses used: active, on_hold, past_due, cancelled, expired. Anything else (pending, failed ...) changes nothing.
 */
export const planUpdateForSubscription = (subscription, user, { at, productIntervals } = {}) => {
  const data = subscription ?? {};
  const status = String(data.status ?? "").toLowerCase();
  const nextBilling = toDate(data.next_billing_date ?? data.current_period_end ?? data.expires_at);
  const scheduledToEnd = data.cancel_at_next_billing_date === true;

  switch (status) {
    case "active": {
      if (!nextBilling) throw new BillingEventError("Subscription has no usable next billing date");
      const update = {
        planStatus: scheduledToEnd ? "cancelling" : "active",
        planAccessUntil: nextBilling,
        cancelAtPeriodEnd: scheduledToEnd,
      };
      const interval = intervalOf(data, productIntervals);
      if (interval) update.planInterval = interval;
      const customerId = cleanId(data.customer?.customer_id);
      if (customerId && !user?.billingCustomerId) update.billingCustomerId = customerId;
      return update;
    }
    case "on_hold":
    case "past_due":
      return isLiveStatus(user?.planStatus) ? { planStatus: "past_due" } : null;
    case "cancelled": {
      // cancelled at period end while the paid period or grace window has not run out yet: still 'cancelling'
      const periodEnd = nextBilling ?? toDate(user?.planAccessUntil);
      if (scheduledToEnd && periodEnd && periodEnd.getTime() + GRACE_DAYS * DAY_MS > at.getTime()) {
        return {
          planStatus: "cancelling",
          cancelAtPeriodEnd: true,
          ...(nextBilling ? { planAccessUntil: nextBilling } : {}),
        };
      }
      return isLiveStatus(user?.planStatus) || toDate(user?.planAccessUntil) ? endAccessNow(user, at) : null;
    }
    case "expired":
      return isLiveStatus(user?.planStatus) || toDate(user?.planAccessUntil) ? endAccessNow(user, at) : null;
    default:
      return null;
  }
};
