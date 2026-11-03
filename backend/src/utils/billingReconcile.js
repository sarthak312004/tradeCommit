// Nightly reconciliation of ONE user against the subscription Dodo returns. Collaborators are passed in so it is testable.
//
// billingLastEventAt means "when the newest webhook we applied happened" (provider event time). A reconciliation run is
// not a provider event, so it NEVER writes that field: stamping it with the run time could make the webhook guard
// reject a valid late-arriving event. Instead the write is optimistic: it only applies if the billing fields are exactly
// as they were when this user was read, so a webhook or an in-app cancel/resume that landed meanwhile always wins.
import { planUpdateForSubscription } from "./billingEvents.js";

const asValue = (value) => (value instanceof Date ? value.getTime() : value ?? null);

// null matches both a stored null and a missing field in MongoDB, so legacy documents are handled.
export const reconcileFilter = (user) => ({
  _id: user._id,
  billingSubscriptionId: user.billingSubscriptionId,
  billingLastEventAt: user.billingLastEventAt ?? null,
  planStatus: user.planStatus ?? null,
  planAccessUntil: user.planAccessUntil ?? null,
  planInterval: user.planInterval ?? null,
  cancelAtPeriodEnd: user.cancelAtPeriodEnd ?? null,
});

const isNoop = (update, user) => Object.entries(update).every(([key, value]) => asValue(value) === asValue(user[key]));

/**
 * Returns 'unchanged' | 'changed' | 'stale'. Throws when Dodo cannot be read or the subscription is unusable;
 * nothing has been written in that case.
 */
export const reconcileUser = async ({ User, client, user, productIntervals, now = () => new Date() }) => {
  const at = now(); // taken before the provider call, like POST /billing/sync
  const subscription = await client.subscriptions.retrieve(user.billingSubscriptionId);
  const update = planUpdateForSubscription(subscription, user, { at, productIntervals });
  if (!update || isNoop(update, user)) return "unchanged";

  const result = await User.updateOne(reconcileFilter(user), { $set: update });
  return (result?.matchedCount ?? result?.n ?? 0) > 0 ? "changed" : "stale";
};
