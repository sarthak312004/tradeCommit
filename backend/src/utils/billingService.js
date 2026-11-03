// Billing logic with its collaborators passed in (database models, payment client), so it can be tested without a database.
// controllers/billing.controller.js wires the real ones.
import { ApiError } from "./ApiError.js";
import { ApiResponse } from "./ApiResponse.js";
import { asyncHandler } from "./asyncHandler.js";
import { BillingEventError, eventSubject, eventTime, isLiveStatus, planUpdateFor } from "./billingEvents.js";

const INTERVALS = ["monthly", "yearly"];
// Product ids come from the server environment only; the client just says "monthly" or "yearly".
const PRODUCT_ENV = { monthly: "DODO_PRODUCT_PRO_MONTHLY", yearly: "DODO_PRODUCT_PRO_YEARLY" };

const productIdFor = (interval) => process.env[PRODUCT_ENV[interval]]?.trim() || null;

const productIntervals = () => {
  const map = {};
  for (const interval of INTERVALS) {
    const id = productIdFor(interval);
    if (id) map[id] = interval;
  }
  return map;
};

const appUrl = () => (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");

/* ---------------------------------- POST /api/v1/billing/checkout ---------------------------------- */

export const createCheckoutHandler = ({ getClient }) =>
  asyncHandler(async (req, res) => {
    const interval = req.body?.interval;
    if (!INTERVALS.includes(interval)) throw new ApiError(400, 'interval must be "monthly" or "yearly"');

    const user = req.user; // from verifyJWT; never an id from the request
    if (isLiveStatus(user.planStatus)) {
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

// Which email (if any) a change of state deserves
const transitionEmail = (from, to) => {
  if (to === from) return null;
  if (to === "past_due") return "payment-failed";
  if (to === "cancelling") return "cancellation-scheduled"; // e.g. cancelled from the payment portal; the in-app cancel sets it first, so no second email
  if (to === "expired") return "downgrade-complete";
  return null;
};

const resolveUser = async ({ User: Users, BillingEvent: Events }, subject) => {
  if (subject.userId && OBJECT_ID.test(subject.userId)) {
    const user = await Users.findById(subject.userId).select(USER_FIELDS).lean();
    if (user) return user;
  }
  if (subject.subscriptionId) {
    const user = await Users.findOne({ billingSubscriptionId: subject.subscriptionId }).select(USER_FIELDS).lean();
    if (user) return user;
  }
  if (subject.paymentId) {
    // refund / dispute events may carry only the payment: find the user through an earlier event of that payment
    const earlier = await Events.findOne({ paymentId: subject.paymentId, userId: { $ne: null } }).lean();
    if (earlier) return Users.findById(earlier.userId).select(USER_FIELDS).lean();
  }
  return null;
};

/**
 * Applies one verified event. Safe to run twice: duplicates are skipped by event id, and every change is a SET,
 * guarded so an older event can never overwrite a newer one. Returns 'duplicate' | 'applied' | 'stale' | 'ignored' | 'no_user'.
 */
export const processBillingEvent = async (deps, event, eventId) => {
  const { User: Users, BillingEvent: Events, now = Date.now } = deps;
  if (await Events.exists({ eventId })) return "duplicate";

  const subject = eventSubject(event);
  const at = eventTime(event, now());
  const user = await resolveUser(deps, subject);

  let outcome = "ignored";
  let transition = null;
  let update = null;
  if (!user) {
    console.warn(`Billing webhook: no matching user for ${event?.type}`); // event type only, no ids or payload
    outcome = "no_user";
  } else {
    update = planUpdateFor(event, user, { at, productIntervals: deps.productIntervals ?? productIntervals() });
    if (update) {
      const result = await Users.updateOne(
        {
          _id: user._id,
          // out-of-order guard: only apply when no newer event was applied before
          $or: [{ billingLastEventAt: null }, { billingLastEventAt: { $exists: false } }, { billingLastEventAt: { $lte: at } }],
        },
        { $set: { ...update, billingLastEventAt: at } }
      );
      outcome = (result?.matchedCount ?? result?.n ?? 0) > 0 ? "applied" : "stale";
      if (outcome === "applied") transition = transitionEmail(user.planStatus, update.planStatus);
    }
  }

  try {
    await Events.create({ eventId, type: String(event?.type ?? "unknown"), userId: user?._id ?? null, paymentId: subject.paymentId });
  } catch (error) {
    if (error?.code !== 11000) throw error; // a concurrent retry already recorded it: fine
  }

  // Notify only on a real change of state, and after the event is recorded, so a retry cannot send it twice. Best effort.
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
