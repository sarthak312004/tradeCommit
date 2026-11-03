// What the /billing page shows, decided from the plan state the server reports. Pure: no React, no network.
// The server stays the source of truth; nothing here grants or removes access.

const LIVE_STATUSES = ['active', 'cancelling', 'past_due']
const INTERVAL_LABELS = { monthly: 'Monthly', yearly: 'Yearly' }

/** A subscription that exists with the payment provider (including one that ends at the period end). */
export const isLiveStatus = (status) => LIVE_STATUSES.includes(status)

const toDate = (iso) => {
  const date = iso ? new Date(iso) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

export const formatDate = (iso) => {
  const date = toDate(iso)
  return date ? date.toLocaleDateString(undefined, { dateStyle: 'medium' }) : null
}

/** Error text for a failed billing request. */
export const billingErrorText = (error, fallback = 'Something went wrong. Please try again.') => {
  if (error instanceof TypeError) return "Can't reach the server. Check your connection and try again."
  return error?.message || fallback
}

/**
 * @param {object|null} planState  { plan, status, accessUntil, cancelAtPeriodEnd, interval }
 * @param {Date|number} now        injected for tests
 */
export const billingView = (planState, now = Date.now()) => {
  const status = planState?.status ?? 'none'
  const isPro = planState?.plan === 'pro'
  const until = formatDate(planState?.accessUntil)
  const untilDate = toDate(planState?.accessUntil)
  const live = isLiveStatus(status)
  const nowMs = now instanceof Date ? now.getTime() : now

  let badge
  let summary
  switch (status) {
    case 'active':
      badge = { label: 'Active', tone: 'positive' }
      summary = until ? `Renews on ${until}.` : 'Your subscription is active.'
      break
    case 'cancelling':
      badge = { label: 'Ending', tone: 'open' }
      summary = until ? `Pro until ${until}. It will not renew.` : 'Pro until the end of your paid period. It will not renew.'
      break
    case 'past_due':
      badge = { label: 'Payment issue', tone: 'negative' }
      summary = 'We could not take your last payment. Update your payment method to keep Pro.'
      break
    case 'expired':
      badge = { label: isPro ? 'Ending soon' : 'Ended', tone: 'neutral' }
      summary = 'Your subscription has ended. Your data is safe.'
      break
    default:
      badge = { label: isPro ? 'Pro' : 'Free', tone: 'neutral' }
      summary = isPro ? 'Pro features are included in your account.' : 'You are on the free plan.'
  }

  return {
    status,
    live,
    until,
    badge,
    summary,
    intervalLabel: INTERVAL_LABELS[planState?.interval] ?? null,
    isPro,
    canCancel: status === 'active' || status === 'past_due',
    canResume: status === 'cancelling' && Boolean(untilDate) && untilDate.getTime() > nowMs,
    showPastDueBanner: status === 'past_due',
    // the portal needs a customer at the payment provider, which anyone who ever subscribed has
    showPortal: status !== 'none',
    showSync: status !== 'none',
    showUpgrade: !live && (!isPro || status === 'expired'),
  }
}
