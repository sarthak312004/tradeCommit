// Self-service billing: status, customer portal, cancel at period end, resume, sync.
// Collaborators are passed in (models, Dodo client, mailer) so the state transitions can be tested without a database or network.
// Safety rules: the user comes only from req.user; the Dodo customer / subscription ids come from the user document,
// never from the request; nothing here grants Pro (only planAccessUntil does, and only webhooks / sync move it from Dodo's data).
import { ApiError } from "./ApiError.js";
import { ApiResponse } from "./ApiResponse.js";
import { asyncHandler } from "./asyncHandler.js";
import { BillingEventError, extractProductId, isLiveStatus, planUpdateFor, planUpdateForSubscription } from "./billingEvents.js";
import { isSubscriptionTermElapsed, planState } from "./entitlements.js";

const IDS = "+billingCustomerId +billingSubscriptionId +billingLastEventAt";
const cleanEnv = (value) => (value ?? "").trim().replace(/^['"]+|['"]+$/g, "").trim();
const appUrl = () => cleanEnv(process.env.APP_URL).replace(/\/+$/, "");
const toMs = (value) => {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(ms) ? ms : null;
};

const productIntervals = () => {
  const map = {};
  const monthly = cleanEnv(process.env.DODO_PRODUCT_PRO_MONTHLY);
  const yearly = cleanEnv(process.env.DODO_PRODUCT_PRO_YEARLY);
  if (monthly) map[monthly] = "monthly";
  if (yearly) map[yearly] = "yearly";
  return map;
};

const cleanId = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

const listItems = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const belongsToUser = (record, user) => {
  if (!record || !user) return false;
  const metaUserId = cleanId(record.metadata?.userId);
  if (metaUserId) return metaUserId === String(user._id);
  const custId = cleanId(record.customer?.customer_id);
  if (custId && user.billingCustomerId) return custId === user.billingCustomerId;
  const email = cleanId(record.customer?.email)?.toLowerCase();
  if (email && user.email) return email === String(user.email).trim().toLowerCase();
  return false;
};

const isConfiguredProduct = (record, intervals) => {
  const pid = extractProductId(record);
  return Boolean(pid && intervals?.[pid]);
};

const respond = (res, user, message) => res.status(200).json(new ApiResponse(200, planState(user, Date.now()), message));

export const createBillingManageHandlers = ({ User, getClient, sendEmail = async () => false, now = Date.now }) => {
  const loadUser = async (req) => {
    const user = await User.findById(req.user._id).select(IDS).lean();
    if (!user) throw new ApiError(401, "Unauthorized request");
    return user;
  };

  const requireClient = async () => {
    const client = await getClient();
    if (!client) throw new ApiError(503, "Billing is not available right now. Please try again later.");
    return client;
  };

  const providerFailure = (error, action) => {
    console.error(`Dodo ${action} failed:`, error?.status ?? error?.name); // status / name only, never the payload
    return new ApiError(502, "We could not reach the payment provider. Please try again.");
  };

  // Only moves forward from the states named in `from`, so a webhook that already ended the plan is not undone by a late click.
  const setState = async (userId, from, update) => {
    const result = await User.updateOne({ _id: userId, planStatus: { $in: from } }, { $set: update });
    return (result?.matchedCount ?? result?.n ?? 0) > 0;
  };

  const requireSubscription = (user) => {
    if (!isLiveStatus(user.planStatus) || !user.billingSubscriptionId) {
      throw new ApiError(409, "You do not have an active subscription.", [], "", { code: "NO_SUBSCRIPTION" });
    }
    return user.billingSubscriptionId;
  };

  /* GET /billing/status */
  const status = asyncHandler(async (req, res) => respond(res, req.user, "Billing status"));

  /* POST /billing/portal */
  const portal = asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    const base = appUrl();
    if (!user.billingCustomerId) throw new ApiError(409, "There is no billing account to manage yet.", [], "", { code: "NO_CUSTOMER" });
    if (!base) throw new ApiError(503, "Billing is not available right now. Please try again later.");
    const client = await requireClient();

    let session;
    try {
      session = await client.customers.customerPortal.create(user.billingCustomerId, { return_url: `${base}/billing` });
    } catch (error) {
      throw providerFailure(error, "portal session");
    }
    const url = session?.link;
    if (typeof url !== "string" || !url.startsWith("https://")) throw new ApiError(502, "Could not open the billing portal. Please try again.");
    return res.status(200).json(new ApiResponse(200, { url }, "Portal ready"));
  });

  /* POST /billing/cancel : at the end of the paid period, never now */
  const cancel = asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    if (user.planStatus === "cancelling") return respond(res, user, "Cancellation already scheduled"); // idempotent
    const subscriptionId = requireSubscription(user);
    const client = await requireClient();

    let subscription;
    try {
      subscription = await client.subscriptions.update(subscriptionId, { cancel_at_next_billing_date: true });
    } catch (error) {
      throw providerFailure(error, "cancel");
    }

    const providerEnd = toMs(subscription?.next_billing_date);
    const update = { planStatus: "cancelling", cancelAtPeriodEnd: true };
    if (providerEnd) update.planAccessUntil = new Date(providerEnd);
    const changed = await setState(user._id, ["active", "past_due"], update);

    const fresh = { ...user, ...(changed ? update : {}) };
    if (changed) await sendEmail({ to: user.email, name: user.fullname || user.username, kind: "cancellation-scheduled", accessUntil: fresh.planAccessUntil });
    return respond(res, fresh, "Cancellation scheduled");
  });

  /* POST /billing/resume : undo a scheduled cancellation while the paid period is still running */
  const resume = asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    if (user.planStatus === "active") return respond(res, user, "Subscription is active"); // idempotent
    if (user.planStatus !== "cancelling") throw new ApiError(409, "There is no scheduled cancellation to undo.", [], "", { code: "NOT_CANCELLING" });
    const until = toMs(user.planAccessUntil);
    if (!until || until <= now()) {
      throw new ApiError(409, "Your paid period has ended. Please subscribe again.", [], "", { code: "PERIOD_ENDED" });
    }
    const subscriptionId = requireSubscription(user);
    const client = await requireClient();

    try {
      await client.subscriptions.update(subscriptionId, { cancel_at_next_billing_date: false });
    } catch (error) {
      throw providerFailure(error, "resume");
    }

    const update = { planStatus: "active", cancelAtPeriodEnd: false };
    const changed = await setState(user._id, ["cancelling"], update);
    return respond(res, changed ? { ...user, ...update } : user, "Subscription resumed");
  });

  /* POST /billing/sync : re-read the subscription from Dodo and reconcile (repairs a missed webhook) */
  const sync = asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    const hintSubId = cleanId(req.body?.subscriptionId ?? req.body?.subscription_id);
    const hintPayId = cleanId(req.body?.paymentId ?? req.body?.payment_id);

    if (!user.billingSubscriptionId && !hintSubId && !hintPayId) {
      const maybeClient = await getClient();
      const canDiscover =
        typeof maybeClient?.subscriptions?.list === "function" ||
        typeof maybeClient?.payments?.list === "function";
      if (!canDiscover) return respond(res, user, "Nothing to sync"); // never subscribed: nothing to reconcile
    }

    const client = await requireClient();
    const at = new Date(now());
    const intervals = productIntervals();
    let subscription = null;
    let discoveredSubId = null;
    let paymentUpdate = null;
    let lookupError = null;
    const lookup = async (action, operation, fallback = null) => {
      try {
        return await operation();
      } catch (error) {
        lookupError ??= error;
        console.error(`Dodo ${action} failed:`, error?.status ?? error?.name);
        return fallback;
      }
    };

    if (hintSubId && hintSubId !== user.billingSubscriptionId && typeof client.subscriptions?.retrieve === "function") {
      const candidate = await lookup("subscription lookup", () => client.subscriptions.retrieve(hintSubId));
      if (candidate && belongsToUser(candidate, user) && isConfiguredProduct(candidate, intervals)) {
        subscription = candidate;
        discoveredSubId = cleanId(candidate.subscription_id) ?? hintSubId;
      }
    }

    if (!subscription && hintPayId && typeof client.payments?.retrieve === "function") {
      const pay = await lookup("payment lookup", () => client.payments.retrieve(hintPayId));
      if (pay && belongsToUser(pay, user)) {
        const paySubId = cleanId(pay.subscription_id);
        if (paySubId && typeof client.subscriptions?.retrieve === "function") {
          const sub = await lookup("subscription lookup", () => client.subscriptions.retrieve(paySubId));
          if (sub && isConfiguredProduct(sub, intervals)) {
            subscription = sub;
            discoveredSubId = cleanId(sub.subscription_id) ?? paySubId;
          }
        } else if (String(pay.status ?? "").toLowerCase() === "succeeded" && isConfiguredProduct(pay, intervals)) {
          const paidAt = toMs(pay.created_at) ? new Date(pay.created_at) : at;
          paymentUpdate = planUpdateFor(
            { type: "payment.succeeded", timestamp: paidAt.toISOString(), data: pay },
            user,
            { at: paidAt, productIntervals: intervals }
          );
        }
      }
    }

    if (!subscription && !paymentUpdate && user.billingSubscriptionId) {
      try {
        subscription = await client.subscriptions.retrieve(user.billingSubscriptionId);
      } catch (error) {
        throw providerFailure(error, "sync");
      }
    }

    // If the user is not yet on an active yearly subscription, check Dodo's list endpoints when available
    // (covers missed webhooks and one-time yearly product setups in Dodo).
    const currentSubInterval = subscription ? intervals[extractProductId(subscription)] : null;
    if (typeof client.subscriptions?.list === "function" && (!subscription || currentSubInterval !== "yearly")) {
      const query = user.billingCustomerId ? { customer_id: user.billingCustomerId } : {};
      const listRes = await lookup("subscription list", () => client.subscriptions.list(query));
      const candidates = listItems(listRes).filter(
        (s) => String(s?.status ?? "").toLowerCase() === "active" && belongsToUser(s, user) && isConfiguredProduct(s, intervals)
      );
      const best =
        candidates.find((s) => intervals[extractProductId(s)] === "yearly") ??
        (!subscription ? candidates[0] : null);
      if (best) {
        const bestId = cleanId(best.subscription_id);
        const full = bestId && !best.next_billing_date && typeof client.subscriptions?.retrieve === "function"
          ? await lookup("subscription lookup", () => client.subscriptions.retrieve(bestId), best)
          : best;
        if (full) {
          subscription = full;
          discoveredSubId = bestId;
        }
      }
    }

    const resolvedInterval = subscription ? intervals[extractProductId(subscription)] : null;
    if (!paymentUpdate && typeof client.payments?.list === "function" && (!subscription || resolvedInterval !== "yearly")) {
      const query = user.billingCustomerId ? { customer_id: user.billingCustomerId } : {};
      const payRes = await lookup("payment list", () => client.payments.list(query));
      const succeeded = listItems(payRes)
        .filter((p) => {
          const st = String(p?.status ?? "").toLowerCase();
          return (st === "succeeded" || !p?.status) && !cleanId(p?.subscription_id);
        })
        .slice(0, 5);
      for (const summary of succeeded) {
        const pid = cleanId(summary?.payment_id);
        const fullPay =
          pid && !extractProductId(summary) && typeof client.payments?.retrieve === "function"
            ? await lookup("payment lookup", () => client.payments.retrieve(pid), summary)
            : summary;
        if (
          fullPay &&
          String(fullPay.status ?? "succeeded").toLowerCase() === "succeeded" &&
          !cleanId(fullPay.subscription_id) &&
          belongsToUser(fullPay, user) &&
          isConfiguredProduct(fullPay, intervals)
        ) {
          const payInterval = intervals[extractProductId(fullPay)];
          if (!subscription || payInterval === "yearly") {
            const paidAt = toMs(fullPay.created_at) ? new Date(fullPay.created_at) : at;
            paymentUpdate = planUpdateFor(
              { type: "payment.succeeded", timestamp: paidAt.toISOString(), data: fullPay },
              user,
              { at: paidAt, productIntervals: intervals }
            );
            if (paymentUpdate) break;
          }
        }
      }
    }

    let update = paymentUpdate;
    if (!update) {
      const hasNewCheckoutHint = Boolean((hintSubId && hintSubId !== user.billingSubscriptionId) || hintPayId);
      const resolvedInterval = subscription ? intervals[extractProductId(subscription)] : null;
      if (lookupError && (!subscription || (hasNewCheckoutHint && resolvedInterval !== "yearly"))) {
        throw providerFailure(lookupError, "sync lookup");
      }
      if (!subscription) return respond(res, user, "Nothing to sync");
      try {
        update = planUpdateForSubscription(subscription, user, { at, productIntervals: intervals });
        if (update && discoveredSubId && discoveredSubId !== user.billingSubscriptionId) {
          update.billingSubscriptionId = discoveredSubId;
        }
      } catch (error) {
        if (!(error instanceof BillingEventError)) throw error;
        console.error("Billing sync could not apply the subscription:", error.message);
        throw new ApiError(502, "Could not read your subscription. Please try again later.");
      }
    }
    if (!update) return respond(res, user, "Already up to date");

    const resolvedSubscriptionId = paymentUpdate
      ? null
      : discoveredSubId ?? cleanId(subscription?.subscription_id) ?? user.billingSubscriptionId;
    const isNewSubscription = resolvedSubscriptionId !== user.billingSubscriptionId;
    if (
      user.planStatus !== "cancelling" &&
      isLiveStatus(user.planStatus) &&
      user.planInterval === "monthly" &&
      update.planInterval === "yearly" &&
      isNewSubscription &&
      !isSubscriptionTermElapsed(user, at)
    ) {
      throw new ApiError(409, "Cancel your monthly subscription before starting yearly billing.", [], "", { code: "CANCEL_MONTHLY_FIRST" });
    }

    // same out-of-order guard as the webhook: a newer applied event wins over this snapshot
    const result = await User.updateOne(
      { _id: user._id, $or: [{ billingLastEventAt: null }, { billingLastEventAt: { $exists: false } }, { billingLastEventAt: { $lte: at } }] },
      { $set: { ...update, billingLastEventAt: at } }
    );
    const applied = (result?.matchedCount ?? result?.n ?? 0) > 0;
    return respond(res, applied ? { ...user, ...update } : user, applied ? "Billing status refreshed" : "Already up to date");
  });

  return { status, portal, cancel, resume, sync };
};
