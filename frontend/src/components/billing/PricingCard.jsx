import { useState } from 'react'
import { displayRegion, pricingView } from '../../config/pricing'
import { usePlan } from '../../hooks/usePlan'
import { requestJson } from '../../utils/http'
import { lockedFeatureBullets } from '../../utils/planFeatures'
import { focusRing } from '../common/controlStyles'

const INTERVALS = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' }
]
const UNIT = { monthly: 'month', yearly: 'year' }
const FALLBACK_URL = import.meta.env.VITE_UPGRADE_URL

/**
 * Monthly / yearly choice, the price (display only), what Pro adds, and the Upgrade button.
 * The checkout request sends ONLY { interval }: the server picks the product, Dodo picks the amount.
 * Used by the upgrade modal and the /billing page.
 */
export default function PricingCard({ onBusyChange, secondaryAction = null }) {
  const { entitlements } = usePlan()
  const [interval, setBillingInterval] = useState('yearly')
  const [region] = useState(displayRegion)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const view = pricingView(interval, region)
  const bullets = lockedFeatureBullets(entitlements)
  const unit = UNIT[interval]

  const changeBusy = (value) => {
    setBusy(value)
    onBusyChange?.(value)
  }

  const upgrade = async () => {
    if (busy) return
    changeBusy(true)
    setError('')
    try {
      const data = await requestJson('/api/v1/billing/checkout', { method: 'POST', body: { interval } })
      if (!data?.url) throw new Error('Could not start checkout.')
      window.location.assign(data.url)
    } catch (checkoutError) {
      if (checkoutError.status === 404 && FALLBACK_URL) {
        window.location.assign(FALLBACK_URL)
        return
      }
      setError(checkoutError instanceof TypeError ? "Can't reach the server. Check your connection and try again." : checkoutError.message || 'Could not start checkout.')
      changeBusy(false)
    }
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Billing period" className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-white/[0.06]">
        {INTERVALS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={interval === item.id}
            onClick={() => setBillingInterval(item.id)}
            disabled={busy}
            className={`flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${focusRing} ${interval === item.id ? 'bg-white text-zinc-900 shadow-sm dark:bg-white/[0.14] dark:text-zinc-50' : 'text-zinc-600 dark:text-zinc-300'}`}
          >
            {item.label}
            {item.id === 'yearly' && view.savingsPercent > 0 && (
              <span className="rounded bg-emerald-600/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300">Save {view.savingsPercent}%</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4" aria-live="polite">
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-50">{view.primary.text}</span>
          <span className="text-xs text-zinc-600 dark:text-zinc-300">/ {unit}</span>
        </p>
        {view.primary.perMonthText && <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">about {view.primary.perMonthText} a month</p>}
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
          {view.secondary.regionLabel}: {view.secondary.text} / {unit}
        </p>
      </div>

      {bullets.length > 0 && (
        <ul className="mt-4 space-y-1.5" aria-label="What Pro adds">
          {bullets.map((bullet) => (
            <li key={bullet.id} className="flex items-start gap-2 text-[13px] leading-5 text-zinc-700 dark:text-zinc-200">
              <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m4 10.5 4 4 8-9" />
              </svg>
              {bullet.text}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[11px] leading-4 text-zinc-600 dark:text-zinc-300">Final price is shown at checkout based on your billing country</p>

      {error && <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        {secondaryAction}
        <button type="button" onClick={upgrade} disabled={busy} className={`h-9 cursor-pointer rounded-md bg-zinc-900 px-4 text-xs font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 ${focusRing}`}>
          {busy ? 'Opening checkout…' : 'Upgrade'}
        </button>
      </div>
    </div>
  )
}
