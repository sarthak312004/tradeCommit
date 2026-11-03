/* ------------------------------------------------------------------
 * Analytics access on the client: a thin adapter over the server's entitlements.
 *
 * WHO MAY SEE WHICH METRIC is decided on the server only: backend/src/config/plans.config.js (METRIC_TIERS)
 * is turned into `entitlements.metricAccess` ({ [metricId]: boolean }) by GET /auth/profile. Nothing here knows a
 * plan name or a tier, so moving a metric between Free and Pro is a change in that one backend file.
 *
 * This file only keeps what the UI needs to draw a locked section: the metric ids with a human label, and which ids
 * make up each analysis tab. Calculation (utils/tradeMetrics.js, utils/tradeBreakdowns.js) knows nothing about access.
 *
 * Analytics are computed in the browser, so this is a soft gate (it shapes the UI, it does not protect the data).
 * ------------------------------------------------------------------ */

// metric id -> label shown in locked-section previews. Every id must also exist in the backend's METRIC_TIERS
// (backend/src/utils/entitlements.test.js checks that), otherwise the server would lock it for everyone.
export const METRIC_LABELS = {
  // basic analytics
  totalTrades: 'Total trades',
  winRate: 'Win rate',
  netPnl: 'Net P&L',
  winsLosses: 'Winners and losers',
  avgWinLoss: 'Average win and loss',
  bestWorstTrade: 'Best and worst trade',
  avgRiskReward: 'Reward to risk',
  equityCurve: 'Equity curve',
  monthlyPnl: 'Monthly P&L',
  longShort: 'Long vs short',
  // advanced financial and risk analytics
  profitFactor: 'Profit factor',
  expectancy: 'Expectancy',
  avgR: 'Average R',
  maxDrawdown: 'Max drawdown',
  recoveryFactor: 'Recovery factor',
  streaks: 'Win and loss streaks',
  riskConsistency: 'Risk consistency',
  // performance breakdowns
  dayOfWeek: 'Day of week',
  timeOfDay: 'Time of day',
  holdingDuration: 'Holding duration',
  monthlyHeatmap: 'Monthly heatmap',
  strategyBreakdown: 'Strategy breakdown',
  instrumentBreakdown: 'Instrument breakdown',
  setupBreakdown: 'Setup breakdown',
  longShortDetail: 'Long vs short detail',
  rangeComparison: 'Period comparison',
  // advanced visualizations
  drawdownChart: 'Drawdown chart',
  pnlDistribution: 'Result distribution',
  rMultipleDistribution: 'R-multiple distribution',
  // filters
  analyticsFilters: 'Filters'
}

// The metrics each analysis tab is made of. When the server locks every one of them, the tab shows ONE upgrade prompt.
export const TAB_METRICS = {
  overview: [
    'totalTrades', 'winRate', 'netPnl', 'winsLosses', 'avgWinLoss', 'bestWorstTrade', 'avgRiskReward', 'equityCurve',
    'monthlyPnl', 'longShort', 'profitFactor', 'expectancy', 'avgR', 'maxDrawdown', 'recoveryFactor', 'streaks',
    'riskConsistency', 'drawdownChart'
  ],
  breakdown: [
    'monthlyHeatmap', 'dayOfWeek', 'timeOfDay', 'holdingDuration', 'instrumentBreakdown', 'strategyBreakdown',
    'setupBreakdown', 'longShortDetail'
  ],
  distribution: ['pnlDistribution', 'rMultipleDistribution'],
  compare: ['rangeComparison']
}

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** Whether these entitlements carry the server's metric answers (false until the profile has loaded). */
export const hasMetricAccess = (entitlements) => isObject(entitlements) && isObject(entitlements.metricAccess)

/**
 * Whether the signed-in user may see `metricId`. Only an explicit `true` from the server counts: not loaded yet,
 * an unknown metric or a malformed answer are all "no", never silently open.
 */
export const canViewMetric = (metricId, entitlements) => entitlements?.metricAccess?.[metricId] === true

/** 'loading' until the profile arrives, 'ready' when it carries metric access, 'error' when it failed or lacks it. */
export const accessStatus = ({ profile, error } = {}) => {
  if (!profile) return error ? 'error' : 'loading'
  return hasMetricAccess(profile.entitlements) ? 'ready' : 'error'
}

/** The metric ids from `ids` the user may not see (each once, in order). */
export const lockedMetricIds = (ids, entitlements) => [...new Set(ids)].filter((id) => !canViewMetric(id, entitlements))

/** True when the server locks every metric of the tab (an unknown tab is never reported as locked). */
export const isTabLocked = (tab, entitlements) => {
  const ids = TAB_METRICS[tab]
  return Array.isArray(ids) && ids.length > 0 && ids.every((id) => !canViewMetric(id, entitlements))
}

/** Label for a metric id, with a neutral fallback so a locked preview never shows a raw id. */
export const metricLabel = (id) => METRIC_LABELS[id] ?? 'This metric'
