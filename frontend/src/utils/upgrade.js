import { PLAN_LIMIT_EVENT } from './http.js'

/** Opens the one UpgradeModal (mounted in Home). `feature` is the entitlement key (or 'import') that blocked the user. */
export const openUpgrade = (feature) => window.dispatchEvent(new CustomEvent(PLAN_LIMIT_EVENT, { detail: { feature } }))

// What the modal says per blocked feature. No numbers here: limits are read from the user's entitlements by the caller.
const COPY = {
  maxJournals: ['More journals', 'You have reached the journal limit of your plan. Upgrade to keep more journals.'],
  maxPlanners: ['More planners', 'You have reached the planner limit of your plan. Upgrade to keep more planners.'],
  readonly_journal: ['Read-only journal', 'This journal is read-only on the Free plan. Upgrade to edit or add trades.'],
  readonly_planner: ['Read-only planner', 'This planner is read-only on the Free plan. Upgrade to edit or add plans.'],
  aiRangeReviews: ['Date-range AI reviews', 'Review any period you choose, not just a single week.'],
  aiHistory: ['AI review history', 'Browse and reopen every review the mentor has written for you.'],
  aiWeeklyPer7Days: ['More AI reviews', 'You have used the AI reviews your plan allows this week.'],
  exportDays: ['Full export range', 'Export your whole trade history, not just the most recent days.'],
  import: ['Bigger imports', 'Import more trades at once.'],
  autoLogWebhook: ['Trade webhooks', 'Automatically log executed trades from your broker or charting platform.'],
  analytics: ['Full analytics', 'Unlock every analytics tab, metric and filter.']
}
export const upgradeCopy = (feature) => {
  const [title, body] = COPY[feature] ?? ['Upgrade to Pro', 'Unlock everything TradeCommit Pro has to offer.']
  return { title, body }
}
