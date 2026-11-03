// The pure rules behind the AI allowance: no database, no network. aiQuota.js adds the reads and writes.
// Every cap comes from the user's entitlements (config/plans.config.js); nothing here knows a plan name.
import { getEffectivePlan, getEntitlements } from "./entitlements.js";

// All limits can be tuned from environment variables without touching code.
const int = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const aiLimits = () => {
  const total = int("AI_DAILY_BUDGET", 200);
  return {
    firstTrades: int("AI_REVIEW_FIRST_TRADES", 5), // trades a week needs before its first review unlocks
    stepTrades: int("AI_REVIEW_STEP_TRADES", 5), // new trades needed to unlock a refreshed review
    perDay: int("AI_REVIEW_PER_DAY", 1), // reviews one trader can generate per rolling 24 hours (the per-7-days cap is an entitlement)
    dailyBudget: total, // the budget when AI_DAILY_BUDGET_PRO is not set; keep the pools together below your real Gemini limit
    // Each plan draws on its own pool of the day's generations, so one plan can never use up the other's capacity.
    // Pools are keyed by the plan the user had when the review was reserved (see AiUsage.plan).
    dailyBudgets: {
      free: int("AI_DAILY_BUDGET_FREE", 50),
      pro: int("AI_DAILY_BUDGET_PRO", total),
    },
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

const waitText = (until, now = Date.now()) => {
  const minutes = Math.max(1, Math.ceil((until - now) / 60_000));
  if (minutes < 60) return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
  return `in about ${Math.ceil(hours / 24)} days`;
};

/** Entitlements as given, or, when a caller has none to hand, those of a user without billing data (rollout mode decides). */
export const resolveEntitlements = (entitlements) =>
  entitlements && typeof entitlements === "object" ? entitlements : getEntitlements(null);

/** The caps and the plan for this request's user. Controllers call this once and pass both on. */
export const aiContextFor = (user) => ({ entitlements: getEntitlements(user), plan: getEffectivePlan(user) });

/** Reviews allowed per rolling 7 days: entitlements.aiWeeklyPer7Days. null = unlimited (Infinity); anything unusable = 0. */
export const weeklyCap = (entitlements) => {
  const value = resolveEntitlements(entitlements).aiWeeklyPer7Days;
  if (value === null) return Infinity;
  return Number.isInteger(value) && value >= 0 ? value : 0;
};

/** The day's generation budget of the pool this plan draws on. A plan without a pool gets the smallest one. */
export const dailyBudgetFor = (plan, limits = aiLimits()) =>
  limits.dailyBudgets[plan] ?? Math.min(...Object.values(limits.dailyBudgets));

/** Mongo filter for the rows of one budget pool: this plan's, plus legacy rows that carry no plan (null matches a missing field). */
export const poolFilter = (plan) => ({ plan: { $in: [plan, null] } });

/** Plan to record on a reservation: the caller's, else the one a user without billing data would have. */
export const resolvePlan = (plan) => (plan ? String(plan) : getEffectivePlan(null));

/**
 * The allowance from a trader's confirmed reviews of the last 7 days (rows sorted oldest first, each with createdAt).
 * Same result shape as before: { usage, blocked, reason, nextAvailableAt, message, generating }.
 */
export const buildQuota = ({ rows, now = Date.now(), perDay, perWeek, generating = false }) => {
  const lastDay = rows.filter((row) => new Date(row.createdAt).getTime() >= now - DAY_MS);
  const usage = {
    day: { used: lastDay.length, limit: perDay },
    week: { used: rows.length, limit: Number.isFinite(perWeek) ? perWeek : null },
  };

  if (perWeek === 0) {
    return { usage, blocked: true, reason: "weekly_limit", nextAvailableAt: null, message: "Your plan does not include AI reviews.", generating };
  }

  const blockedUntil = [];
  if (lastDay.length >= perDay) blockedUntil.push(new Date(lastDay[lastDay.length - perDay].createdAt).getTime() + DAY_MS);
  if (rows.length >= perWeek) blockedUntil.push(new Date(rows[rows.length - perWeek].createdAt).getTime() + 7 * DAY_MS);

  if (!blockedUntil.length) return { usage, blocked: false, reason: null, nextAvailableAt: null, message: "", generating };

  const until = Math.max(...blockedUntil);
  const weekly = rows.length >= perWeek;
  return {
    usage,
    blocked: true,
    reason: weekly ? "weekly_limit" : "daily_limit",
    nextAvailableAt: new Date(until).toISOString(),
    message: `You've used your ${weekly ? `${plural(perWeek, "review")} for this 7-day period` : `${plural(perDay, "review")} for today`}. The next one is available ${waitText(until, now)}.`,
    generating,
  };
};
