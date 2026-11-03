// Self-service billing: status, customer portal, cancel at period end, resume, sync.
// Collaborators are passed in (models, Dodo client, mailer) so the state transitions can be tested without a database or network.
// Safety rules: the user comes only from req.user; the Dodo customer / subscription ids come from the user document,
// never from the request; nothing here grants Pro (only planAccessUntil does, and only webhooks / sync move it from Dodo's data).
import { ApiError } from "./ApiError.js";
import { ApiResponse } from "./ApiResponse.js";
import { asyncHandler } from "./asyncHandler.js";
import { BillingEventError, isLiveStatus, planUpdateForSubscription } from "./billingEvents.js";
import { planState } from "./entitlements.js";

const IDS = "+billingCustomerId +billingSubscriptionId +billingLastEventAt";
const appUrl = () => (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
const toMs = (value) => {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(ms) ? ms : null;
};

const productIntervals = () => {
  const map = {};
  const monthly = process.env.DODO_PRODUCT_PRO_MONTHLY?.trim();
  const yearly = process.env.DODO_PRODUCT_PRO_YEARLY?.trim();
  if (monthly) map[monthly] = "monthly";
  if (yearly) map[yearly] = "yearly";
  return map;
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
    if (!user.billingSubscriptionId) return respond(res, user, "Nothing to sync"); // never subscribed: nothing to reconcile
    const client = await requireClient();

    const at = new Date(now());
    let subscription;
    try {
      subscription = await client.subscriptions.retrieve(user.billingSubscriptionId);
    } catch (error) {
      throw providerFailure(error, "sync");
    }

    let update;
    try {
      update = planUpdateForSubscription(subscription, user, { at, productIntervals: productIntervals() });
    } catch (error) {
      if (!(error instanceof BillingEventError)) throw error;
      console.error("Billing sync could not apply the subscription:", error.message);
      throw new ApiError(502, "Could not read your subscription. Please try again later.");
    }
    if (!update) return respond(res, user, "Already up to date");

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
