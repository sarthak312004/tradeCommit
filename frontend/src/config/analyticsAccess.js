/* ------------------------------------------------------------------
 * Analytics feature access: the ONE place that decides which metrics a plan may see.
 *
 * Calculation lives in utils/tradeMetrics.js and knows nothing about plans.
 * The UI asks `canViewMetric(metricId, plan)` before rendering a metric. Whole sections go through
 * <MetricGate> (components/rightContainer/journal/analytics/MetricGate.jsx), so no component
 * checks a plan on its own.
 *
 * Today every metric is free and enforcement is OFF. To restrict a metric later:
 *   1. set its tier below to 'pro' (or any tier listed in PLAN_RANK),
 *   2. flip ENFORCE_METRIC_ACCESS to true,
 *   3. pass the user's real plan where `plan` is read (currently DEFAULT_PLAN).
 * No calculation code has to change.
 * ------------------------------------------------------------------ */

export const PLAN_RANK = { free: 0, pro: 1 }
export const DEFAULT_PLAN = 'free'

// Master switch. While false, every metric is visible to every plan.
export const ENFORCE_METRIC_ACCESS = false

export const METRIC_ACCESS = {
  // basic analytics
  totalTrades: 'free',
  winRate: 'free',
  netPnl: 'free',
  winsLosses: 'free',
  avgWinLoss: 'free',
  bestWorstTrade: 'free',
  avgRiskReward: 'free',
  equityCurve: 'free',
  monthlyPnl: 'free',
  longShort: 'free',
  // advanced financial and risk analytics
  profitFactor: 'free',
  expectancy: 'free',
  avgR: 'free',
  maxDrawdown: 'free',
  recoveryFactor: 'free',
  streaks: 'free',
  riskConsistency: 'free',
  // performance breakdowns
  dayOfWeek: 'free',
  timeOfDay: 'free',
  holdingDuration: 'free',
  monthlyHeatmap: 'free',
  strategyBreakdown: 'free',
  instrumentBreakdown: 'free',
  setupBreakdown: 'free',
  longShortDetail: 'free',
  rangeComparison: 'free',
  // advanced visualizations
  drawdownChart: 'free',
  pnlDistribution: 'free',
  rMultipleDistribution: 'free',
  // filters
  analyticsFilters: 'free'
}

/** Whether `plan` may see `metricId`. Unknown metrics default to the strictest known tier, never silently open. */
export const canViewMetric = (metricId, plan = DEFAULT_PLAN) => {
  if (!ENFORCE_METRIC_ACCESS) return true
  const required = METRIC_ACCESS[metricId] ?? 'pro'
  return (PLAN_RANK[plan] ?? 0) >= (PLAN_RANK[required] ?? Infinity)
}
