// Pure rules: what a Dodo Payments webhook event does to a user's billing state. No database, no network.
// Webhooks only ever move planStatus / planAccessUntil and the billing ids; entitlements.js turns those into access.
//
//   subscription.active | renewed | plan_changed  -> 'active' (or 'cancelling'), planAccessUntil = next_billing_date
//   subscription.on_hold | past_due | payment.failed -> 'past_due' (access continues through the grace window)
//   subscription.cancelled (end of period)         -> 'cancelling', access unchanged
//   subscription.cancelled (immediately)           -> 'expired', access ends now
//   subscription.expired | refund.succeeded | dispute.lost -> 'expired', access ends now
//
// Every result is a plain SET of values, so handling the same event twice leaves the same state.

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

// The interval comes from OUR product ids first (never from anything a client sent), then from the provider's field.
const intervalOf = (data, productIntervals) => {
  const byProduct = productIntervals?.[cleanId(data.product_id)];
  if (INTERVALS.includes(byProduct)) return byProduct;
  const frequency = String(data.payment_frequency_interval ?? "").toLowerCase();
  if (frequency === "month") return "monthly";
  if (frequency === "year") return "yearly";
  return null;
};

const endAccessNow = (user, at) => {
  const current = toDate(user?.planAccessUntil);
  // never extend access by "ending" it: keep the earlier of the current end and the event time
  const until = current && current.getTime() < at.getTime() ? current : at;
  return { planStatus: "expired", planAccessUntil: until, cancelAtPeriodEnd: false };
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
      const nextBilling = toDate(data.next_billing_date);
      if (!nextBilling) throw new BillingEventError("Subscription event has no usable next billing date");
      const update = {
        planStatus: data.cancel_at_next_billing_date === true ? "cancelling" : "active",
        planAccessUntil: nextBilling,
        cancelAtPeriodEnd: data.cancel_at_next_billing_date === true,
      };
      const interval = intervalOf(data, productIntervals);
      if (interval) update.planInterval = interval;
      if (subject.customerId) update.billingCustomerId = subject.customerId;
      if (subject.subscriptionId) update.billingSubscriptionId = subject.subscriptionId;
      return update;
    }

    case "subscription.on_hold":
    case "subscription.past_due":
    case "payment.failed":
      // only a subscriber can fall behind; a failed first payment of a free user changes nothing
      return isLiveStatus(user?.planStatus) ? { planStatus: "past_due" } : null;

    case "subscription.cancelled": {
      if (data.cancel_at_next_billing_date === true) {
        const update = { planStatus: "cancelling", cancelAtPeriodEnd: true };
        const nextBilling = toDate(data.next_billing_date);
        if (!toDate(user?.planAccessUntil) && nextBilling) update.planAccessUntil = nextBilling;
        return update;
      }
      return endAccessNow(user, at);
    }

    case "subscription.expired":
    case "refund.succeeded":
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
 * Statuses used: active, on_hold, cancelled, expired. Anything else (pending, failed ...) changes nothing.
 */
export const planUpdateForSubscription = (subscription, user, { at, productIntervals } = {}) => {
  const data = subscription ?? {};
  const status = String(data.status ?? "").toLowerCase();
  const nextBilling = toDate(data.next_billing_date);
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
      return update;
    }
    case "on_hold":
      return isLiveStatus(user?.planStatus) ? { planStatus: "past_due" } : null;
    case "cancelled": {
      // cancelled at period end but the paid period has not run out yet: still 'cancelling'
      if (scheduledToEnd && nextBilling && nextBilling.getTime() > at.getTime()) {
        return { planStatus: "cancelling", cancelAtPeriodEnd: true, planAccessUntil: nextBilling };
      }
      return isLiveStatus(user?.planStatus) || toDate(user?.planAccessUntil) ? endAccessNow(user, at) : null;
    }
    case "expired":
      return isLiveStatus(user?.planStatus) || toDate(user?.planAccessUntil) ? endAccessNow(user, at) : null;
    default:
      return null;
  }
};
