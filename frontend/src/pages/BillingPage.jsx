import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import CancelDialog from '../components/billing/CancelDialog'
import ScrollFade from '../components/common/ScrollFade'
import { controlNeutral, focusRing } from '../components/common/controlStyles'
import TopBar from '../components/rightContainer/TopBar'
import { FREE_PLAN_EXCLUDED_FEATURES, FREE_PLAN_FEATURES, PRO_PLAN_FEATURES } from '../config/planFeatures'
import { displayRegion, formatPrice, pricingView, REGION_IN } from '../config/pricing'
import { useActivationPolling } from '../hooks/useActivationPolling'
import { usePlan } from '../hooks/usePlan'
import { billingApi } from '../services/billingApi'
import { refreshProfile } from '../services/profileApi'
import { billingErrorText, billingView, isLiveStatus } from '../utils/billingView'
import { requestJson } from '../utils/http'

const INTERVALS = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
]
const UNIT = { monthly: 'month', yearly: 'year' }
const FALLBACK_URL = import.meta.env.VITE_UPGRADE_URL

const STATUS_DOT = {
  positive: 'bg-emerald-600 dark:bg-emerald-400',
  open: 'bg-amber-500 dark:bg-amber-300',
  negative: 'bg-rose-600 dark:bg-rose-400',
  neutral: 'bg-zinc-500 dark:bg-zinc-400',
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-emerald-700/30 border-t-emerald-700 motion-reduce:animate-none dark:border-emerald-300/30 dark:border-t-emerald-300"
    />
  )
}

function CheckMark({ accent = false }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${accent ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m4 10.5 4 4 8-9" />
    </svg>
  )
}

function UnavailableMark() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="m6 6 8 8M14 6l-8 8" />
    </svg>
  )
}

/**
 * /billing and /billing/success (where checkout returns).
 * Minimal, side-by-side Free vs Pro layout inspired by Claude's billing page:
 * - Active plan is hinted inline in the header and on the active plan card (never inside a separate status box).
 * - Expanded plan details remain within the page's scrollable content area.
 * - On /billing/success, automatically reconciles with Dodo (POST /billing/sync) in addition to polling status.
 */
export default function BillingPage() {
  const { planState, loading } = usePlan()
  const location = useLocation()
  const justPaid = location.pathname.endsWith('/success')

  const urlHints = useMemo(() => {
    const params = new URLSearchParams(location.search || '')
    const subscriptionId = params.get('subscription_id') || params.get('subscriptionId') || undefined
    const paymentId = params.get('payment_id') || params.get('paymentId') || undefined
    return { subscriptionId, paymentId }
  }, [location.search])

  const [live, setLive] = useState(null)
  const currentPlanState = live ?? planState
  const view = billingView(currentPlanState)

  const [interval, setBillingInterval] = useState('yearly')
  const [region] = useState(displayRegion)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const initialSyncDone = useRef(false)

  const pricing = pricingView(interval, region)
  const unit = UNIT[interval]
  const freePriceText = formatPrice(0, region === REGION_IN ? 'inr' : 'usd')

  const watching = justPaid && !loading && (!view.live || (urlHints.subscriptionId && currentPlanState?.interval === 'monthly'))

  const adopt = useCallback((state) => {
    if (state && typeof state === 'object' && state.status) setLive(state)
    refreshProfile()
    window.dispatchEvent(new Event('plan-state-changed'))
  }, [])

  const activation = useActivationPolling({ enabled: watching, onActive: adopt })

  // Immediately ask the server to sync with Dodo when returning to /billing/success
  useEffect(() => {
    if (!justPaid || loading || initialSyncDone.current) return
    initialSyncDone.current = true
    billingApi
      .sync(urlHints)
      .then((data) => {
        if (data && (isLiveStatus(data.status) || data.plan === 'pro')) adopt(data)
      })
      .catch((syncError) => {
        setError(billingErrorText(syncError))
      })
  }, [justPaid, loading, urlHints, adopt])

  const runAction = async (name, action, { done = '' } = {}) => {
    if (busy) return null
    setBusy(name)
    setError('')
    setNotice('')
    try {
      const data = await action()
      if (done) setNotice(done)
      return data ?? true
    } catch (requestError) {
      setError(billingErrorText(requestError))
      return null
    } finally {
      setBusy('')
    }
  }

  const startCheckout = async (targetInterval = interval) => {
    await runAction('checkout', async () => {
      try {
        const data = await requestJson('/api/v1/billing/checkout', { method: 'POST', body: { interval: targetInterval } })
        if (!data?.url) throw new Error('Could not start checkout.')
        window.location.assign(data.url)
      } catch (checkoutError) {
        if (checkoutError.status === 404 && FALLBACK_URL) {
          window.location.assign(FALLBACK_URL)
          return
        }
        throw checkoutError
      }
    })
  }

  const openPortal = async () => {
    const data = await runAction('portal', () => billingApi.portal())
    if (data?.url) window.location.assign(data.url)
  }

  const cancel = async () => {
    const data = await runAction('cancel', () => billingApi.cancel())
    if (!data) return
    setConfirming(false)
    adopt(data)
    setNotice('Cancellation scheduled. You keep Pro until the end of your paid period.')
  }

  const resume = async () => {
    const data = await runAction('resume', () => billingApi.resume(), {
      done: 'Welcome back. Your subscription will renew as usual.',
    })
    if (data) adopt(data)
  }

  const sync = async () => {
    const data = await runAction('sync', () => billingApi.sync(urlHints), {
      done: 'Billing status is up to date.',
    })
    if (data) adopt(data)
    if (watching) activation.restart()
  }

  const canSwitchToYearly =
    view.isPro &&
    view.live &&
    currentPlanState?.status === 'cancelling' &&
    currentPlanState?.interval === 'monthly' &&
    interval === 'yearly'

  return (
    <>
      <TopBar label="Account" title="Plan & billing" />
      <ScrollFade
        className="flex min-h-0 flex-1 flex-col"
        scrollClassName="subtle-scrollbar flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6"
      >
        <section aria-labelledby="billing-title" className="mx-auto flex w-full max-w-3xl flex-col">
          {/* Minimal header row: active plan hinted inline (not in a box) + Monthly/Yearly pill toggle */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[view.badge.tone] ?? STATUS_DOT.neutral}`} />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {view.isPro
                    ? `TradeCommit Pro${view.intervalLabel ? ` (${view.intervalLabel})` : ''}`
                    : 'Free plan'}
                </span>
                <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">·</span>
                <span>{loading ? 'Checking your plan…' : view.summary}</span>
              </div>
              <h2 id="billing-title" className="mt-1 text-lg font-semibold tracking-[-0.02em] text-zinc-900 sm:text-xl dark:text-zinc-50">
                Choose the plan that fits your trading
              </h2>
            </div>

            <div
              role="radiogroup"
              aria-label="Billing period"
              className="inline-flex h-8 shrink-0 self-start rounded-full border border-zinc-300/90 bg-black/[0.04] p-0.5 sm:self-auto dark:border-white/[0.12] dark:bg-white/[0.05]"
            >
              {INTERVALS.map((item) => {
                const active = interval === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setBillingInterval(item.id)}
                    disabled={Boolean(busy)}
                    className={`inline-flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${focusRing} ${
                      active
                        ? 'bg-white text-zinc-900 shadow-xs dark:bg-white/[0.15] dark:text-zinc-50'
                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    {item.label}
                    {item.id === 'yearly' && pricing.savingsPercent > 0 && (
                      <span className="text-[10px] font-semibold text-[#b95b3b] dark:text-[#e08a68]">
                        -{pricing.savingsPercent}%
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Inline non-intrusive status strips */}
          {watching && (
            <div
              role="status"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-700/25 bg-emerald-600/[0.08] px-3.5 py-2.5 text-xs text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-400/[0.08] dark:text-emerald-200"
            >
              <span className="flex items-center gap-2 font-medium">
                <Spinner />
                {activation.phase === 'timeout'
                  ? 'Still confirming your payment with Dodo Payments. Your payment is safe.'
                  : 'Activating your Pro plan…'}
              </span>
              <button
                type="button"
                onClick={sync}
                disabled={busy === 'sync'}
                className="cursor-pointer font-semibold underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
              >
                {busy === 'sync' ? 'Checking…' : 'Check now'}
              </button>
            </div>
          )}

          {!watching && justPaid && view.isPro && (
            <p role="status" className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              Thanks! Your Pro plan is active.
            </p>
          )}

          {view.showLegacyBanner && (
            <p role="status" className="mt-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              Early-user grant: all Pro features are unlocked free on your account until {view.until}.
            </p>
          )}

          {view.showPastDueBanner && (
            <div
              role="alert"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-700/30 bg-rose-600/[0.08] px-3.5 py-2.5 text-xs text-rose-900 dark:border-rose-400/30 dark:bg-rose-400/[0.08] dark:text-rose-200"
            >
              <span>We could not process your last renewal. Update your payment method so Pro stays active.</span>
              <button
                type="button"
                onClick={openPortal}
                disabled={Boolean(busy)}
                className="cursor-pointer font-semibold underline underline-offset-2"
              >
                {busy === 'portal' ? 'Opening…' : 'Update payment method'}
              </button>
            </div>
          )}

          {/* Side-by-side plan comparison cards within the scrollable billing content area. */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
            {/* FREE PLAN CARD */}
            <article
              aria-label="Free plan"
              className={`flex flex-col justify-between rounded-2xl border p-5 transition-colors ${
                !view.isPro
                  ? 'border-zinc-400/90 bg-white/90 dark:border-white/[0.22] dark:bg-panel'
                  : 'border-zinc-300/75 bg-white/60 dark:border-white/[0.10] dark:bg-panel/70'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Free</h3>
                  {!view.isPro && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                      Current plan
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  Core trading tools
                </p>

                <div className="mt-3.5 flex items-baseline justify-between gap-2 border-b border-zinc-200/80 pb-3.5 dark:border-white/[0.08]">
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-50">
                      {freePriceText}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">/ forever</span>
                  </p>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Always free</span>
                </div>

                <ul className="mt-3.5 space-y-2" aria-label="Free plan features">
                  {FREE_PLAN_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[12.5px] leading-5 text-zinc-700 dark:text-zinc-300">
                      <CheckMark />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3.5 border-t border-zinc-200/80 pt-3 dark:border-white/[0.08]">
                  <p className="mb-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Not included</p>
                  <ul className="space-y-2" aria-label="Features not included in Free">
                    {FREE_PLAN_EXCLUDED_FEATURES.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[12.5px] leading-5 text-zinc-500 dark:text-zinc-400">
                        <UnavailableMark />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 pt-1">
                <div className="flex h-9 items-center justify-center rounded-lg border border-zinc-200/80 bg-zinc-100/60 text-xs font-medium text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-zinc-400">
                  {!view.isPro ? 'Current plan' : 'Included in your account'}
                </div>
              </div>
            </article>

            {/* PRO PLAN CARD */}
            <article
              aria-label="TradeCommit Pro plan"
              className={`tc-surface flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-[var(--shadow-card)] transition-colors dark:bg-panel ${
                view.isPro
                  ? 'border-zinc-900/35 ring-1 ring-zinc-900/10 dark:border-white/[0.28] dark:ring-white/[0.08]'
                  : 'border-zinc-300 dark:border-white/[0.16]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Pro</h3>
                  {view.isPro ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[view.badge.tone] ?? STATUS_DOT.positive}`} />
                      Current plan{view.intervalLabel ? ` · ${view.intervalLabel}` : ''}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b95b3b] dark:text-[#e08a68]">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  Everything in Free, plus full access to TradeCommit.
                </p>

                <div
                  className="mt-3.5 flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200/80 pb-3.5 dark:border-white/[0.08]"
                  aria-live="polite"
                >
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-50">
                      {pricing.primary.text}
                    </span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">/ {unit}</span>
                    {pricing.primary.perMonthText && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">(~{pricing.primary.perMonthText}/mo)</span>
                    )}
                  </p>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {pricing.secondary.regionLabel}: {pricing.secondary.text}/{unit}
                  </span>
                </div>

                <ul className="mt-3.5 space-y-2" aria-label="Pro plan features">
                  {PRO_PLAN_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[12.5px] leading-5 text-zinc-800 dark:text-zinc-200">
                      <CheckMark accent />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 pt-1">
                {view.showUpgrade ? (
                  <button
                    type="button"
                    onClick={() => startCheckout(interval)}
                    disabled={Boolean(busy)}
                    className={`flex h-9 w-full cursor-pointer items-center justify-center rounded-lg bg-zinc-900 px-4 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${focusRing}`}
                  >
                    {busy === 'checkout' ? 'Opening checkout…' : `Upgrade to Pro (${interval === 'yearly' ? 'Yearly' : 'Monthly'})`}
                  </button>
                ) : canSwitchToYearly ? (
                  <button
                    type="button"
                    onClick={() => startCheckout('yearly')}
                    disabled={Boolean(busy)}
                    className={`flex h-9 w-full cursor-pointer items-center justify-center rounded-lg bg-zinc-900 px-4 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${focusRing}`}
                  >
                    {busy === 'checkout'
                      ? 'Opening checkout…'
                      : `Switch to Yearly${pricing.savingsPercent > 0 ? ` · Save ${pricing.savingsPercent}%` : ''}`}
                  </button>
                ) : view.canResume ? (
                  <button
                    type="button"
                    onClick={resume}
                    disabled={Boolean(busy)}
                    className={`flex h-9 w-full cursor-pointer items-center justify-center rounded-lg bg-zinc-900 px-4 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${focusRing}`}
                  >
                    {busy === 'resume' ? 'Resuming…' : 'Resume Pro subscription'}
                  </button>
                ) : (
                  <div className="flex h-9 items-center justify-between rounded-lg border border-zinc-200/80 bg-zinc-100/60 px-3 text-xs text-zinc-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-300">
                    <span className="inline-flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-100">
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[view.badge.tone] ?? STATUS_DOT.positive}`} />
                      {view.badge.label} {view.intervalLabel ? `· ${view.intervalLabel}` : 'plan'}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {view.until ? (view.status === 'cancelling' ? `Ends ${view.until}` : `Renews ${view.until}`) : 'Active'}
                    </span>
                  </div>
                )}
              </div>
            </article>
          </div>

          {/* Unboxed minimal footer bar for self-service billing actions */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-zinc-300/70 pt-3.5 text-xs text-zinc-600 dark:border-white/[0.08] dark:text-zinc-400">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Final price is shown at checkout based on your billing country.</span>
              <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">·</span>
              <button
                type="button"
                onClick={sync}
                disabled={Boolean(busy)}
                className="cursor-pointer font-medium text-zinc-700 underline underline-offset-4 transition-colors hover:text-zinc-950 disabled:cursor-wait disabled:opacity-60 dark:text-zinc-300 dark:hover:text-white"
              >
                {busy === 'sync' ? 'Refreshing…' : 'Refresh billing status'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {view.showPortal && (
                <button
                  type="button"
                  onClick={openPortal}
                  disabled={Boolean(busy)}
                  className={controlNeutral}
                >
                  {busy === 'portal' ? 'Opening…' : 'Payment & invoices'}
                </button>
              )}
              {view.canResume && (
                <button
                  type="button"
                  onClick={resume}
                  disabled={Boolean(busy)}
                  className={controlNeutral}
                >
                  {busy === 'resume' ? 'Resuming…' : 'Resume subscription'}
                </button>
              )}
              {view.canCancel && (
                <button
                  type="button"
                  onClick={() => {
                    setError('')
                    setConfirming(true)
                  }}
                  disabled={Boolean(busy)}
                  className="cursor-pointer text-xs font-medium text-zinc-500 transition-colors hover:text-rose-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-rose-400"
                >
                  Cancel subscription
                </button>
              )}
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>
              By continuing with checkout, you agree to our{' '}
              <Link to="/terms" className={`underline underline-offset-2 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200 ${focusRing}`}>
                Terms &amp; Conditions
              </Link>{' '}
              and acknowledge our{' '}
              <Link to="/privacy" className={`underline underline-offset-2 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200 ${focusRing}`}>
                Privacy Policy
              </Link>
              .
            </span>
            <nav aria-label="Billing policies" className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link to="/refund-policy" className={`transition-colors hover:text-zinc-800 hover:underline hover:underline-offset-2 dark:hover:text-zinc-200 ${focusRing}`}>
                Refund Policy
              </Link>
              <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
              <Link to="/cancellation-policy" className={`transition-colors hover:text-zinc-800 hover:underline hover:underline-offset-2 dark:hover:text-zinc-200 ${focusRing}`}>
                Cancellation Policy
              </Link>
              <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
              <Link to="/contact" className={`transition-colors hover:text-zinc-800 hover:underline hover:underline-offset-2 dark:hover:text-zinc-200 ${focusRing}`}>
                Contact
              </Link>
            </nav>
          </div>

          <div aria-live="polite">
            {notice && <p className="mt-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">{notice}</p>}
            {error && !confirming && <p role="alert" className="mt-2.5 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
          </div>

          {confirming && (
            <CancelDialog
              until={view.until}
              busy={busy === 'cancel'}
              error={error}
              onConfirm={cancel}
              onClose={() => {
                setConfirming(false)
                setError('')
              }}
            />
          )}
        </section>
      </ScrollFade>
    </>
  )
}
