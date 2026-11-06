/* ------------------------------------------------------------------
 * Plan rules: the ONE file that says what Free and Pro users get.
 *
 * Every enforcement point (backend and frontend) reads a key of the user's `entitlements`
 * (built by utils/entitlements.js from this file). Nothing else may hardcode a limit or compare a plan
 * name (no `plan === "pro"`); a guard test (utils/planGuard.test.js) fails the build if one appears.
 *
 * HOW TO MOVE A FEATURE BETWEEN PLANS
 *   - A limit or switch (journals, planners, AI reviews, export range, import size, Deep Mode ...):
 *     change that key's value inside PLANS.free and/or PLANS.pro below.
 *       numbers   -> the limit, `null` means unlimited
 *       booleans  -> `true` allows the feature, `false` blocks it
 *       analytics -> 'basic' | 'full'
 *     Example: let Free users keep 2 journals -> PLANS.free.maxJournals = 2.
 *   - An analytics metric: change its tier in METRIC_TIERS ('free' | 'pro'). The id must match the one in
 *     frontend/src/config/analyticsAccess.js (a test checks that every id there is listed here).
 *     A metric that is missing here is treated as locked for everyone.
 *   - A brand-new entitlement key: add it to BOTH plans here, then read it where it is enforced.
 *     (utils/entitlements.js picks it up automatically, including for overrides.)
 *   - No redeploy needed for a one-off change: env PLAN_OVERRIDES_JSON (per plan, see entitlements.js) or the
 *     per-user `entitlementOverrides` field. Neither is ever writable by a client.
 * ------------------------------------------------------------------ */

export const PLANS = {
  free: {
    maxJournals: 1,
    maxPlanners: 1,
    analytics: "basic",
    aiWeeklyPer7Days: 1,
    aiRangeReviews: false,
    aiHistory: false,
    aiCarryForward: true,
    exportDays: 30,
    importMaxPerCommit: 50,
    deepMode: true,
  },
  pro: {
    maxJournals: null,
    maxPlanners: null,
    analytics: "full",
    aiWeeklyPer7Days: 3,
    aiRangeReviews: true,
    aiHistory: true,
    aiCarryForward: true,
    exportDays: null,
    importMaxPerCommit: null,
    deepMode: true,
  },
};

// metricId -> the lowest plan that may see it ('free' = everyone, 'pro' = Pro only)
export const METRIC_TIERS = {
  // basic analytics (top strip, equity curve & filters)
  totalTrades: "free",
  winRate: "free",
  netPnl: "free",
  winsLosses: "free",
  avgWinLoss: "free",
  avgRiskReward: "free",
  equityCurve: "free",
  analyticsFilters: "free",
  // advanced financial and risk analytics (Pro section below basic row)
  bestWorstTrade: "pro",
  monthlyPnl: "pro",
  longShort: "pro",
  profitFactor: "pro",
  expectancy: "pro",
  avgR: "pro",
  maxDrawdown: "pro",
  recoveryFactor: "pro",
  streaks: "pro",
  riskConsistency: "pro",
  // performance breakdowns
  dayOfWeek: "pro",
  timeOfDay: "pro",
  holdingDuration: "pro",
  monthlyHeatmap: "pro",
  strategyBreakdown: "pro",
  instrumentBreakdown: "pro",
  setupBreakdown: "pro",
  longShortDetail: "pro",
  rangeComparison: "pro",
  // advanced visualizations
  drawdownChart: "pro",
  pnlDistribution: "pro",
  rMultipleDistribution: "pro",
};

// Days of Pro access kept after planAccessUntil (late renewals / failed payments). Env GRACE_DAYS, default 3.
const DEFAULT_GRACE_DAYS = 3;
const parseGraceDays = (raw) => {
  if (raw === undefined || raw === null || String(raw).trim() === "") return DEFAULT_GRACE_DAYS;
  const days = Number(raw);
  return Number.isFinite(days) && days >= 0 ? days : DEFAULT_GRACE_DAYS;
};
export const GRACE_DAYS = parseGraceDays(process.env.GRACE_DAYS);
