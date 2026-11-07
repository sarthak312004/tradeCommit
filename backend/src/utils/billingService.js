// Billing logic with its collaborators passed in (database models, payment client), so it can be tested without a database.
// controllers/billing.controller.js wires the real ones.
import { randomUUID } from "node:crypto";
import { ApiError } from "./ApiError.js";
import { ApiResponse } from "./ApiResponse.js";
import { asyncHandler } from "./asyncHandler.js";
import { BillingEventError, eventSubject, eventTime, extractProductId, isLiveStatus, planUpdateFor } from "./billingEvents.js";
import { isSubscriptionTermElapsed } from "./entitlements.js";

const INTERVALS = ["monthly", "yearly"];
// Product ids come from the server environment only; the client just says "monthly" or "yearly".
const PRODUCT_ENV = { monthly: "DODO_PRODUCT_PRO_MONTHLY", yearly: "DODO_PRODUCT_PRO_YEARLY" };

const cleanEnv = (value) => (value ?? "").trim().replace(/^['"]+|['"]+$/g, "").trim();
const productIdFor = (interval) => cleanEnv(process.env[PRODUCT_ENV[interval]]) || null;

const productIntervals = () => {
  const map = {};
  for (const interval of INTERVALS) {
    const id = productIdFor(interval);
    if (id) map[id] = interval;
  }
  return map;
};

const appUrl = () => cleanEnv(process.env.APP_URL).replace(/\/+$/, "");

/* ---------------------------------- POST /api/v1/billing/checkout ---------------------------------- */

export const createCheckoutHandler = ({ getClient }) =>
  asyncHandler(async (req, res) => {
    const interval = req.body?.interval;
    if (!INTERVALS.includes(interval)) throw new ApiError(400, 'interval must be "monthly" or "yearly"');

    const user = req.user; // from verifyJWT; never an id from the request
    const isYearlyAfterMonthlyCancellation =
      user.planStatus === "cancelling" && user.planInterval === "monthly" && interval === "yearly";
    if (isLiveStatus(user.planStatus) && !isSubscriptionTermElapsed(user) && !isYearlyAfterMonthlyCancellation) {
      throw new ApiError(409, "You already have a subscription. Manage it from the billing page.", [], "", { code: "ALREADY_SUBSCRIBED" });
    }

    const productId = productIdFor(interval);
    const base = appUrl();
    const client = productId && base ? await getClient() : null;
    if (!client) throw new ApiError(503, "Billing is not available right now. Please try again later.");

    let session;
    try {
      session = await client.checkoutSessions.create({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email: user.email, name: user.fullname || user.username },
        metadata: { userId: String(user._id) },
        return_url: `${base}/billing/success`,
      });
    } catch (error) {
      console.error("Dodo checkout session failed:", error?.status ?? error?.name); // status/name only, never the payload
      throw new ApiError(502, "Could not start checkout. Please try again.");
    }

    const url = session?.checkout_url;
    if (typeof url !== "string" || !url.startsWith("https://")) throw new ApiError(502, "Could not start checkout. Please try again.");
    return res.status(200).json(new ApiResponse(200, { url }, "Checkout ready"));
  });

/* ---------------------------------- POST /api/v1/billing/webhook ---------------------------------- */

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const USER_FIELDS = "+billingSubscriptionId +billingLastEventAt";
const EVENT_LEASE_MS = 5 * 60_000;

// Which email (if any) a change of state deserves
const transitionEmail = (from, to) => {
  if (to === from) return null;
  if (to === "past_due") return "payment-failed";
  if (to === "cancelling") return "cancellation-scheduled"; // e.g. cancelled from the payment portal; the in-app cancel sets it first, so no second email
  if (to === "expired") return "downgrade-complete";
  return null;
};

const resolveUser = async (deps, subject, event, receivedAt = Date.now()) => {
  const { User: Users, BillingEvent: Events } = deps;
  const metadataUserId = subject.userId && OBJECT_ID.test(subject.userId) ? subject.userId : null;
  const subscriptionUser = subject.subscriptionId
    ? await Users.findOne({ billingSubscriptionId: subject.subscriptionId }).select(USER_FIELDS).lean()
    : null;

  if (subscriptionUser) {
    return !metadataUserId || String(subscriptionUser._id) === metadataUserId ? subscriptionUser : null;
  }

  if (subject.paymentId) {
    // Refunds and disputes must resolve through a payment previously associated with this account.
    const earlier = await Events.findOne({ paymentId: subject.paymentId, userId: { $ne: null } }).lean();
    if (earlier) {
      const user = await Users.findById(earlier.userId).select(USER_FIELDS).lean();
      if (!user || (metadataUserId && String(user._id) !== metadataUserId)) return null;
      if (earlier.subscriptionId && user.billingSubscriptionId && earlier.subscriptionId !== user.billingSubscriptionId) return null;
      if (!earlier.subscriptionId && user.billingSubscriptionId && !subject.subscriptionId) return null;
      return user;
    }
    if (["refund.succeeded", "dispute.opened", "dispute.lost"].includes(event?.type)) return null;
  }

  if (!metadataUserId) return null;
  const user = await Users.findById(metadataUserId).select(USER_FIELDS).lean();
  if (!user) return null;

  const intervals = deps.productIntervals ?? productIntervals();
  const eventProductId = extractProductId(event?.data);
  const eventInterval = eventProductId ? intervals?.[eventProductId] : null;
  const isNewPurchaseEvent =
    event?.type === "subscription.active" ||
    (event?.type === "payment.succeeded" && !subject.subscriptionId && Boolean(eventInterval));
  const canReplaceBinding =
    !isLiveStatus(user.planStatus) ||
    isSubscriptionTermElapsed(user, receivedAt) ||
    (user.planStatus === "cancelling" && user.planInterval === "monthly" && eventInterval === "yearly");

  if (!user.billingSubscriptionId && isLiveStatus(user.planStatus) && !canReplaceBinding) return null;
  if (subject.subscriptionId && user.billingSubscriptionId && user.billingSubscriptionId !== subject.subscriptionId) {
    // A verified first activation may represent a new purchase after the former subscription ended or when upgrading to yearly.
    if (!isNewPurchaseEvent || !canReplaceBinding) return null;
  } else if (!subject.subscriptionId && user.billingSubscriptionId) {
    if (!isNewPurchaseEvent || !canReplaceBinding) return null;
  }

  return user;
};

/**
 * Applies one verified event. Safe to run twice: duplicates are skipped by event id, and every change is a SET,
 * guarded so an older event can never overwrite a newer one. Returns 'duplicate' | 'applied' | 'stale' | 'ignored' | 'no_user'.
 */
export const processBillingEvent = async (deps, event, eventId) => {
  const { User: Users, BillingEvent: Events, now = Date.now } = deps;
  const receivedAt = new Date(now()).getTime();
  const subject = eventSubject(event);
  const at = eventTime(event, receivedAt);
  const claimToken = randomUUID();
  try {
    await Events.create({
      eventId,
      type: String(event?.type ?? "unknown"),
      state: "processing",
      claimToken,
      leaseUntil: new Date(receivedAt + EVENT_LEASE_MS),
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const existing = await Events.findOne({ eventId }).lean();
    if (!existing) throw error;
    if (existing.state !== "processing") return "duplicate"; // includes legacy rows with no state field
    if (existing.leaseUntil && new Date(existing.leaseUntil).getTime() > receivedAt) {
      throw new BillingEventError("Webhook event is already being processed");
    }

    const reclaimed = await Events.findOneAndUpdate(
      {
        eventId,
        state: "processing",
        $or: [{ leaseUntil: { $lte: new Date(receivedAt) } }, { leaseUntil: null }, { leaseUntil: { $exists: false } }],
      },
      { $set: { claimToken, leaseUntil: new Date(receivedAt + EVENT_LEASE_MS) } },
      { new: true }
    );
    if (!reclaimed) throw new BillingEventError("Webhook event is already being processed");
  }

  let user = null;
  let transition = null;
  let update = null;
  let outcome = "ignored";
  try {
    user = await resolveUser(deps, subject, event, receivedAt);
    if (!user) {
      console.warn(`Billing webhook: no matching user for ${event?.type}`); // event type only, no ids or payload
      outcome = "no_user";
    } else {
      update = planUpdateFor(event, user, { at, productIntervals: deps.productIntervals ?? productIntervals() });
      if (update) {
        const result = await Users.updateOne(
          {
            _id: user._id,
            // Equal-time events are ambiguous, so the first accepted event wins deterministically.
            $or: [{ billingLastEventAt: null }, { billingLastEventAt: { $exists: false } }, { billingLastEventAt: { $lt: at } }],
          },
          { $set: { ...update, billingLastEventAt: at } }
        );
        outcome = (result?.matchedCount ?? result?.n ?? 0) > 0 ? "applied" : "stale";
        if (outcome === "applied") transition = transitionEmail(user.planStatus, update.planStatus);
      }
    }

    const completed = await Events.updateOne(
      { eventId, state: "processing", claimToken },
      {
        $set: {
          state: "processed",
          processedAt: new Date(now()),
          userId: user?._id ?? null,
          paymentId: subject.paymentId,
          subscriptionId: subject.subscriptionId,
        },
        $unset: { claimToken: 1, leaseUntil: 1 },
      }
    );
    if ((completed?.matchedCount ?? completed?.n ?? 0) === 0) {
      throw new BillingEventError("Webhook event claim was lost");
    }
    if (user?._id && subject.subscriptionId && typeof Events.updateMany === "function") {
      await Events.updateMany(
        { subscriptionId: subject.subscriptionId, userId: null, state: "processed" },
        { $set: { userId: user._id } }
      ).catch((error) => {
        console.error("Could not link prior billing events:", error?.name);
      });
    }
  } catch (error) {
    try {
      await Events.deleteOne({ eventId, state: "processing", claimToken });
    } catch (cleanupError) {
      console.error("Could not release billing event claim:", cleanupError?.name);
    }
    throw error;
  }

  // Notify only after completion is recorded, so a retry cannot send the same best-effort notice twice.
  if (transition && deps.notify) {
    try {
      await deps.notify(transition, user, update);
    } catch (error) {
      console.error("Billing notification failed:", error?.name);
    }
  }
  return outcome;
};

export const createWebhookHandler = ({ getClient, deps }) =>
  asyncHandler(async (req, res) => {
    const raw = req.body;
    if (!Buffer.isBuffer(raw)) throw new ApiError(400, "Invalid webhook body");

    const headers = {
      "webhook-id": req.header("webhook-id"),
      "webhook-signature": req.header("webhook-signature"),
      "webhook-timestamp": req.header("webhook-timestamp"),
    };
    if (!headers["webhook-id"] || !headers["webhook-signature"] || !headers["webhook-timestamp"]) {
      throw new ApiError(401, "Invalid webhook signature");
    }

    if (!process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim()) throw new ApiError(503, "Billing webhooks are not configured");
    const client = await getClient();
    if (!client) throw new ApiError(503, "Billing webhooks are not configured");

    let event;
    try {
      event = await client.webhooks.unwrap(raw.toString("utf8"), { headers }); // verifies signature + timestamp
    } catch {
      throw new ApiError(401, "Invalid webhook signature"); // nothing is processed
    }

    try {
      const outcome = await processBillingEvent(deps, event, headers["webhook-id"]);
      return res.status(200).json(new ApiResponse(200, { received: true, outcome }, "ok"));
    } catch (error) {
      console.error("Billing webhook processing failed:", error instanceof BillingEventError ? error.message : error?.name);
      throw new ApiError(500, "Webhook processing failed"); // 5xx: Dodo retries
    }
  });
