import assert from 'node:assert/strict'
import test from 'node:test'
import { billingErrorText, billingView, formatDate, isLiveStatus } from './billingView.js'

const NOW = Date.parse('2026-11-10T12:00:00Z')
const FUTURE = '2026-12-10T10:00:00Z'
const PAST = '2026-11-01T10:00:00Z'
const state = (status, extra = {}) => ({ plan: 'pro', status, accessUntil: FUTURE, cancelAtPeriodEnd: status === 'cancelling', interval: 'monthly', ...extra })
const view = (planState) => billingView(planState, NOW)

test('isLiveStatus: a subscription that still exists with the provider', () => {
  for (const status of ['active', 'cancelling', 'past_due']) assert.equal(isLiveStatus(status), true)
  for (const status of ['none', 'expired', undefined, null]) assert.equal(isLiveStatus(status), false)
})

test('active: can cancel and manage, cannot resume, no upgrade offer', () => {
  const v = view(state('active'))
  assert.equal(v.badge.label, 'Active')
  assert.equal(v.canCancel, true)
  assert.equal(v.canResume, false)
  assert.equal(v.showPortal, true)
  assert.equal(v.showUpgrade, false)
  assert.equal(v.showPastDueBanner, false)
  assert.match(v.summary, /^Renews on /)
  assert.equal(v.intervalLabel, 'Monthly')
})

test('cancelling: can resume inside the paid period, cannot cancel again', () => {
  const v = view(state('cancelling'))
  assert.equal(v.canResume, true)
  assert.equal(v.canCancel, false)
  assert.match(v.summary, /^Pro until /)
  assert.equal(v.showUpgrade, false)
})

test('cancelling after the paid period ended: no resume button', () => {
  assert.equal(view(state('cancelling', { accessUntil: PAST })).canResume, false)
  assert.equal(view(state('cancelling', { accessUntil: null })).canResume, false)
})

test('past_due: shows the banner, still cancellable, badge says payment issue', () => {
  const v = view(state('past_due'))
  assert.equal(v.showPastDueBanner, true)
  assert.equal(v.canCancel, true)
  assert.equal(v.badge.label, 'Payment issue')
  assert.equal(v.badge.tone, 'negative')
})

test('expired: can subscribe again (even during the grace days) and still reach invoices', () => {
  const grace = view(state('expired', { plan: 'pro' }))
  assert.equal(grace.showUpgrade, true)
  assert.equal(grace.showPortal, true)
  assert.equal(grace.canCancel, false)
  const ended = view(state('expired', { plan: 'free', accessUntil: PAST }))
  assert.equal(ended.showUpgrade, true)
  assert.equal(ended.badge.label, 'Ended')
})

test('free user: upgrade offered, no portal, no cancel', () => {
  const v = view({ plan: 'free', status: 'none', accessUntil: null, cancelAtPeriodEnd: false, interval: null })
  assert.equal(v.badge.label, 'Free')
  assert.equal(v.showUpgrade, true)
  assert.equal(v.showPortal, false)
  assert.equal(v.canCancel, false)
  assert.equal(v.canResume, false)
})

test('Pro without a subscription (early access or plans not enforced): no upgrade button, no portal', () => {
  const v = view({ plan: 'pro', status: 'none', accessUntil: null, cancelAtPeriodEnd: false, interval: null })
  assert.equal(v.showUpgrade, false)
  assert.equal(v.showPortal, false)
  assert.match(v.summary, /included/)
})

test('a missing plan state is treated as free and never throws', () => {
  const v = view(null)
  assert.equal(v.status, 'none')
  assert.equal(v.showUpgrade, true)
})

test('formatDate: invalid input gives null', () => {
  assert.equal(formatDate(null), null)
  assert.equal(formatDate('not a date'), null)
  assert.ok(formatDate(FUTURE))
})

test('billingErrorText: network failures and server messages', () => {
  assert.match(billingErrorText(new TypeError('Failed to fetch')), /Can't reach the server/)
  assert.equal(billingErrorText(new Error('You have refreshed billing a few times already.')), 'You have refreshed billing a few times already.')
  assert.equal(billingErrorText({}), 'Something went wrong. Please try again.')
})
