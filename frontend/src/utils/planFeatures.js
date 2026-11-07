// The bullets of the upgrade pricing card, built from the signed-in user's entitlements (as the server reports them).
// Nothing here knows a number: a limit is printed from the entitlement itself, and a bullet only appears while that
// feature is still limited for this user, so moving a feature between plans in the backend config changes the list.

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

/** [{ id, text }] for what this user does not have yet. Empty while entitlements load or when nothing is limited. */
export const lockedFeatureBullets = (entitlements) => {
  if (!entitlements || typeof entitlements !== 'object') return []
  const bullets = []
  const add = (id, text) => bullets.push({ id, text })

  if (Number.isInteger(entitlements.maxJournals)) add('maxJournals', `More than ${plural(entitlements.maxJournals, 'journal', 'journals')}`)
  if (Number.isInteger(entitlements.maxPlanners)) add('maxPlanners', `More than ${plural(entitlements.maxPlanners, 'planner', 'planners')}`)
  if (entitlements.analytics === 'basic') add('analytics', 'Every analytics tab, metric and filter')
  if (entitlements.aiRangeReviews === false) add('aiRangeReviews', 'AI mentor reviews for any date range')
  if (entitlements.aiHistory === false) add('aiHistory', 'AI review history')
  if (Number.isInteger(entitlements.aiWeeklyPer7Days)) {
    add('aiWeeklyPer7Days', `More than ${plural(entitlements.aiWeeklyPer7Days, 'AI review', 'AI reviews')} a week`)
  }
  if (entitlements.aiCarryForward === false) add('aiCarryForward', 'AI carry-forward into your next plan')
  if (Number.isInteger(entitlements.exportDays)) add('exportDays', `Export beyond the last ${plural(entitlements.exportDays, 'day', 'days')}`)
  if (Number.isInteger(entitlements.importMaxPerCommit)) add('importMaxPerCommit', `Import more than ${plural(entitlements.importMaxPerCommit, 'trade', 'trades')} at once`)
  if (entitlements.deepMode === false) add('deepMode', 'Deep Mode')
  if (entitlements.autoLogWebhook === false) add('autoLogWebhook', 'Auto-log trades from brokers and charting platforms')

  return bullets
}
