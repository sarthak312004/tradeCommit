import { AiUsage } from "../models/aiUsage.models.js";
import { ApiError } from "./ApiError.js";
import { isUserBusy } from "./aiJobGuard.js";

import { aiContextFor, aiLimits, buildQuota, dailyBudgetFor, poolFilter, resolvePlan, weeklyCap } from "./aiQuotaRules.js";

// the limits live in aiQuotaRules.js (pure, testable without a database); re-exported for existing importers
export { aiContextFor, aiLimits };

const DAY_MS = 24 * 60 * 60 * 1000;
// A reservation that is still unconfirmed after this long is treated as dead. The longest a generation can legitimately
// take is the queue wait (60s) plus the queue's hard job limit (140s) plus saving, so about 200s; this adds a margin.
export const PENDING_WINDOW_MS = 4 * 60 * 1000;
const pendingSince = () => new Date(Date.now() - PENDING_WINDOW_MS);

// Reservations created by THIS process that have not finished yet (used to hand them back if the process is stopped).
const liveReservations = new Set();
export const pendingReservationCount = () => liveReservations.size;

/** True while this trader has a generation running, on this instance or any other (reads the unconfirmed reservation). */
export const isGenerating = async (ownerId) => {
  if (isUserBusy(ownerId)) return true;
  return Boolean(await AiUsage.exists({ owner: ownerId, ok: false, createdAt: { $gte: pendingSince() } }));
};

/** The current date in Pacific time, because Gemini's daily free-tier quota resets at midnight Pacific. */
export const pacificDayKey = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * The trader's allowance, one number for every kind of review. Weekly and date-range reviews both write rows to the
 * same AiUsage collection, so a review written in either one counts against the 1-a-day / 3-a-week caps of both.
 * This is read by the weekly and the date-range access checks and by GET /ai-review/quota, so every screen shows
 * the same answer. The 7-day cap is the user's entitlements.aiWeeklyPer7Days (free 1, pro 3 at launch). `blocked` is true while a new review of any kind is not allowed because of the trader's caps.
 */
export const getQuotaSnapshot = async (ownerId, entitlements) => {
  const limits = aiLimits();
  const now = Date.now();

  const mine = await AiUsage.find({ owner: ownerId, ok: true, createdAt: { $gte: new Date(now - 7 * DAY_MS) } })
    .sort({ createdAt: 1 })
    .select("createdAt")
    .lean();

  // one generation per trader at a time, whichever kind of review it is (see aiJobGuard.js and reserveUsage)
  const generating = await isGenerating(ownerId);

  // the per-day cap is the same for everyone; the per-7-days cap is the plan's entitlements.aiWeeklyPer7Days
  return buildQuota({ rows: mine, now, perDay: limits.perDay, perWeek: weeklyCap(entitlements), generating });
};

/**
 * Decides whether a review may be generated for this journal-week (or date range) right now, and explains why not.
 * Order: nothing to do -> not unlocked yet (not enough new trades) -> the trader's own caps -> the global daily budget.
 * `access.quota` is always included, even when nothing needs reviewing, so the client can keep the weekly and the
 * date-range screens in step after either one uses the allowance.
 */
export const evaluateAccess = async ({ week, saved, ownerId, entitlements, plan }) => {
  const limits = aiLimits();

  const needsReview = !saved || saved.inputHash !== week.inputHash;
  const reviewedBefore = saved ? saved.reviewedTradeCount ?? 0 : 0;
  const newTrades = Math.max(0, week.weekTrades.length - reviewedBefore);
  // a finished week unlocks with a single trade; an open week waits for enough trades to find patterns
  // a date-range review never takes the closed-week shortcut: it always needs the full minimum of trades
  // Date ranges have ONE rule, always: the range must hold at least `firstTrades` trades. There is no "5 new trades"
  // step for a refresh; a changed range is simply stale, and refreshing it is bounded by the daily/weekly caps below.
  const isRange = Boolean(week.strictMinimum);
  const rangeCount = week.weekTrades.length;
  const threshold = isRange ? limits.firstTrades : week.isClosed ? 1 : saved ? limits.stepTrades : limits.firstTrades;
  const rulesRewritten = Boolean(saved?.contextHash) && saved.contextHash !== week.contextHash;

  const quota = await getQuotaSnapshot(ownerId, entitlements);
  const pool = resolvePlan(plan);
  // The shared budget counts delivered reviews, plus reservations still waiting on Gemini right now. A reservation that
  // failed is deleted at once (see withUsageReservation); this window also ignores any orphan left by a crash.
  // Only this plan's pool is counted, so one plan can never use up the other's capacity. Rows written before pools
  // existed have no plan; they count towards every pool for the rest of that day.
  const budgetUsed = await AiUsage.countDocuments({
    day: pacificDayKey(),
    ...poolFilter(pool),
    $or: [{ ok: true }, { createdAt: { $gte: pendingSince() } }],
  });

  const { usage } = quota;
  const base = { needsReview, newTrades, threshold, usage, nextAvailableAt: null, quota };

  if (!needsReview) return { ...base, canGenerate: false, reason: "up_to_date", message: "" };

  if (isRange && rangeCount < threshold) {
    const missing = threshold - rangeCount;
    const message = `Log ${plural(missing, "more trade")} in this date range to unlock your review (${rangeCount} of ${threshold}). Or pick a wider range.`;
    return { ...base, newTrades: rangeCount, canGenerate: false, reason: "not_enough_trades", message };
  }

  if (!isRange && !rulesRewritten && newTrades < threshold) {
    const missing = threshold - newTrades;
    const scope = week.scopeLabel; // weekly reviews keep their original wording
    const message = saved
      ? `Log ${plural(missing, "more trade")} in ${scope ?? "this week"} to unlock an updated review (${newTrades} of ${threshold} new trades).`
      : `Log ${plural(missing, "more trade")} ${scope ? `in ${scope}` : "this week"} to unlock your review (${week.weekTrades.length} of ${threshold}). More trades give the mentor real patterns to work with.`;
    return { ...base, canGenerate: false, reason: "not_enough_trades", message };
  }

  if (quota.blocked) {
    return { ...base, canGenerate: false, reason: quota.reason, nextAvailableAt: quota.nextAvailableAt, message: quota.message };
  }

  if (budgetUsed >= dailyBudgetFor(pool, limits)) {
    return { ...base, canGenerate: false, reason: "busy", message: "The AI mentor is receiving a lot of requests right now. Please try again in a few minutes." };
  }

  return { ...base, canGenerate: true, reason: null, message: "" };
};

/**
 * Reserves one generation before Gemini is called, so concurrent traders cannot overshoot the daily budget.
 *
 * The in-memory guards (aiJobGuard, inFlight) only see one process. The reservation row is the shared truth, so after
 * inserting it this re-checks, against the database, what the unsynchronised checks in evaluateAccess could not:
 *  - another unconfirmed reservation of the same trader that is older (smaller _id) wins: this one stands down, so two
 *    instances can never run two generations (and charge two reviews) for one trader;
 *  - the shared daily budget counting only reservations ahead of this one, so a burst cannot overshoot it;
 *  - the trader's own day/week caps (confirmed rows only).
 * A losing reservation is deleted again, so it costs nothing.
 */
export const reserveUsage = async ({ ownerId, journalId, weekStart, entitlements, plan }) => {
  const pool = resolvePlan(plan);
  const usage = await AiUsage.create({ owner: ownerId, journal: journalId, weekStart, day: pacificDayKey(), plan: pool });
  try {
    const since = pendingSince();
    const olderOfMine = await AiUsage.exists({ owner: ownerId, ok: false, _id: { $lt: usage._id }, createdAt: { $gte: since } });
    if (olderOfMine) throw new ApiError(429, "Your other review is still being written. Wait for it to finish, then try again.");

    const aheadOfMe = await AiUsage.countDocuments({ day: usage.day, ...poolFilter(pool), _id: { $lt: usage._id }, $or: [{ ok: true }, { createdAt: { $gte: since } }] });
    if (aheadOfMe >= dailyBudgetFor(pool)) {
      throw new ApiError(429, "The AI mentor is receiving a lot of requests right now. Please try again in a few minutes.");
    }

    const quota = await getQuotaSnapshot(ownerId, entitlements);
    if (quota.blocked) throw new ApiError(429, quota.message);
  } catch (error) {
    await releaseUsage(usage._id).catch((releaseError) => console.error("Could not release a rejected AI review reservation:", releaseError));
    throw error;
  }
  return usage;
};

export const markUsageOk = (id) => AiUsage.updateOne({ _id: id }, { $set: { ok: true } });

/** Gives a reservation back: the review was not delivered, so it must not use any allowance. */
export const releaseUsage = (id) => AiUsage.deleteOne({ _id: id });

// Tells the trader, in the error they see, that a failed attempt cost them nothing.
const withAllowanceNote = (error) => {
  const intentional = error && error.success === false && typeof error.message === "string";
  if (intentional && !/allowance|charged/i.test(error.message)) {
    const message = error.message.trim();
    error.message = `${message}${/[.!?]$/.test(message) ? "" : "."} Your review allowance was not used.`;
  }
  return error;
};

/**
 * Runs `work` (queue -> Gemini -> save the review) under a usage reservation, for weekly and date-range reviews alike.
 *
 *  - `work` resolves: the review was delivered, so the reservation is confirmed (ok: true) and counts toward the
 *    trader's caps and the shared daily budget.
 *  - `work` throws, for ANY reason (Gemini rate limit, queue full, timeout, bad or empty answer, failed save): the
 *    reservation is deleted, so nothing is charged anywhere and the trader can simply try again.
 *
 * The caps only ever count confirmed rows, so a failed attempt can never lock someone out.
 */
export const withUsageReservation = async ({ ownerId, journalId, weekStart, entitlements, plan }, work) => {
  const usage = await reserveUsage({ ownerId, journalId, weekStart, entitlements, plan });
  const id = String(usage._id);
  liveReservations.add(id);

  try {
    let result;
    try {
      result = await work();
    } catch (error) {
      await releaseUsage(usage._id).catch((releaseError) => console.error("Could not release an unused AI review reservation:", releaseError));
      throw withAllowanceNote(error);
    }

    // The review is saved. If confirming keeps failing the trader still keeps the review; the row stays unconfirmed,
    // which simply means it is not counted against them.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await markUsageOk(usage._id);
        break;
      } catch (markError) {
        console.error("Could not confirm an AI review reservation:", markError);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    return result;
  } finally {
    liveReservations.delete(id);
  }
};

/** On shutdown: hands back reservations of generations this process could not finish, so they never linger as "generating". */
export const releasePendingReservations = async () => {
  const ids = [...liveReservations];
  liveReservations.clear();
  if (ids.length) await AiUsage.deleteMany({ _id: { $in: ids }, ok: false });
};
