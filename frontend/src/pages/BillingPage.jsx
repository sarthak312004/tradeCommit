import { useLocation } from 'react-router'
import PricingCard from '../components/billing/PricingCard'
import ScrollFade from '../components/common/ScrollFade'
import { controlNeutral } from '../components/common/controlStyles'
import TopBar from '../components/rightContainer/TopBar'
import { usePlan } from '../hooks/usePlan'
import { refreshProfile } from '../services/profileApi'

const formatDate = (iso) => {
  const date = iso ? new Date(iso) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { dateStyle: 'medium' }) : null
}

// One line about the subscription, from the state the server reports (planState). No amounts here.
const statusLine = (planState) => {
  const until = formatDate(planState?.accessUntil)
  switch (planState?.status) {
    case 'active':
      return until ? `Active. Your plan renews on ${until}.` : 'Active.'
    case 'cancelling':
      return until ? `Cancelled. Pro stays available until ${until}.` : 'Cancelled. Pro stays available until the end of the period.'
    case 'past_due':
      return until ? `We could not take your last payment. Pro stays available while we retry (paid until ${until}).` : 'We could not take your last payment. Pro stays available while we retry.'
    default:
      return null
  }
}

/** /billing and /billing/success (where checkout returns). Shows the current plan, or the pricing card to upgrade. */
export default function BillingPage() {
  const { planState, isPro, loading } = usePlan()
  const justPaid = useLocation().pathname.endsWith('/success')
  const line = statusLine(planState)

  return (
    <>
      <TopBar label="Account" title="Plan & billing" />
      <ScrollFade className="flex min-h-0 flex-1 flex-col" scrollClassName="subtle-scrollbar flex-1 overflow-y-auto p-3 sm:p-6 md:p-8">
        <section aria-labelledby="billing-title" className="mx-auto max-w-md">
          <h2 id="billing-title" className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">TradeCommit Pro</h2>

          {justPaid && (
            <div role="status" className="mt-4 rounded-lg border border-emerald-700/30 bg-emerald-600/10 p-3 text-[13px] leading-5 text-emerald-900 dark:border-emerald-400/30 dark:text-emerald-200">
              <p>Thanks! We are confirming your payment. This usually takes a few seconds.</p>
              <button type="button" onClick={refreshProfile} className={`${controlNeutral} mt-2`}>Refresh status</button>
            </div>
          )}

          {loading ? (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">Loading your plan…</p>
          ) : (
            <>
              {(line || isPro) && (
                <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{line ?? 'Pro features are included in your account.'}</p>
              )}
              {!isPro && (
                <div className="mt-4 rounded-2xl border border-zinc-300 bg-white p-5 dark:border-white/[0.14] dark:bg-panel">
                  <PricingCard />
                </div>
              )}
            </>
          )}
        </section>
      </ScrollFade>
    </>
  )
}
