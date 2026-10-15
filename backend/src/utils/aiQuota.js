import { AiUsage } from "../models/aiUsage.models.js";

// All limits can be tuned from environment variables without touching code.
const int = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const aiLimits = () => ({
  firstTrades: int("AI_REVIEW_FIRST_TRADES", 5), // trades a week needs before its first review unlocks
  stepTrades: int("AI_REVIEW_STEP_TRADES", 5), // new trades needed to unlock a refreshed review
  perDay: int("AI_REVIEW_PER_DAY", 1), // reviews one trader can generate per rolling 24 hours
  perWeek: int("AI_REVIEW_PER_WEEK", 3), // ...and per rolling 7 days
  dailyBudget: int("AI_DAILY_BUDGET", 200), // all traders together per Pacific day; keep it below your real Gemini limit
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** The current date in Pacific time, because Gemini's daily free-tier quota resets at midnight Pacific. */
export const pacificDayKey = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const waitText = (until) => {
  const minutes = Math.max(1, Math.ceil((until - Date.now()) / 60_000));
  if (minutes < 60) return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
  return `in about ${Math.ceil(hours / 24)} days`;
};

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Decides whether a review may be generated for this journal-week right now, and explains why not.
 * Order: nothing to do -> not unlocked yet (not enough new trades) -> the trader's own caps -> the global daily budget.
 */
export const evaluateAccess = async ({ week, saved, ownerId }) => {
  const limits = aiLimits();
  const now = Date.now();

  const needsReview = !saved || saved.inputHash !== week.inputHash;
  const reviewedBefore = saved ? saved.reviewedTradeCount ?? 0 : 0;
  const newTrades = Math.max(0, week.weekTrades.length - reviewedBefore);
  // a finished week unlocks with a single trade; an open week waits for enough trades to find patterns
  // a date-range review never takes the closed-week shortcut: it always needs the full minimum of trades
  const threshold = week.isClosed && !week.strictMinimum ? 1 : saved ? limits.stepTrades : limits.firstTrades;
  const rulesRewritten = Boolean(saved?.contextHash) && saved.contextHash !== week.contextHash;

  const mine = await AiUsage.find({ owner: ownerId, ok: true, createdAt: { $gte: new Date(now - 7 * DAY_MS) } })
    .sort({ createdAt: 1 })
    .select("createdAt")
    .lean();
  const lastDay = mine.filter((row) => new Date(row.createdAt).getTime() >= now - DAY_MS);
  const budgetUsed = await AiUsage.countDocuments({ day: pacificDayKey() });

  const usage = {
    day: { used: lastDay.length, limit: limits.perDay },
    week: { used: mine.length, limit: limits.perWeek },
  };
  const base = { needsReview, newTrades, threshold, usage, nextAvailableAt: null };

  if (!needsReview) return { ...base, canGenerate: false, reason: "up_to_date", message: "" };

  if (!rulesRewritten && newTrades < threshold) {
    const missing = threshold - newTrades;
    const scope = week.scopeLabel; // set for date ranges ("this date range"); weekly reviews keep their original wording
    const message = saved
      ? `Log ${plural(missing, "more trade")} in ${scope ?? "this week"} to unlock an updated review (${newTrades} of ${threshold} new trades).`
      : `Log ${plural(missing, "more trade")} ${scope ? `in ${scope}` : "this week"} to unlock your review (${week.weekTrades.length} of ${threshold}). More trades give the mentor real patterns to work with.`;
    return { ...base, canGenerate: false, reason: "not_enough_trades", message };
  }

  const blockedUntil = [];
  if (lastDay.length >= limits.perDay) blockedUntil.push(new Date(lastDay[lastDay.length - limits.perDay].createdAt).getTime() + DAY_MS);
  if (mine.length >= limits.perWeek) blockedUntil.push(new Date(mine[mine.length - limits.perWeek].createdAt).getTime() + 7 * DAY_MS);
  if (blockedUntil.length) {
    const until = Math.max(...blockedUntil);
    const weekly = mine.length >= limits.perWeek;
    return {
      ...base,
      canGenerate: false,
      reason: weekly ? "weekly_limit" : "daily_limit",
      nextAvailableAt: new Date(until).toISOString(),
      message: `You've used your ${weekly ? `${plural(limits.perWeek, "review")} for this 7-day period` : `${plural(limits.perDay, "review")} for today`}. The next one is available ${waitText(until)}.`,
    };
  }

  if (budgetUsed >= limits.dailyBudget) {
    return { ...base, canGenerate: false, reason: "busy", message: "The free AI mentor has reached its capacity for today. Please come back tomorrow." };
  }

  return { ...base, canGenerate: true, reason: null, message: "" };
};

/** Reserves one generation before Gemini is called, so concurrent traders cannot overshoot the daily budget. */
export const reserveUsage = ({ ownerId, journalId, weekStart }) => AiUsage.create({ owner: ownerId, journal: journalId, weekStart, day: pacificDayKey() });

export const markUsageOk = (id) => AiUsage.updateOne({ _id: id }, { $set: { ok: true } });

/** Gives the reservation back when Gemini was never called (the request was turned away by the queue). */
export const releaseUsage = (id) => AiUsage.deleteOne({ _id: id });
