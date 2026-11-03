import { useCallback, useState } from 'react'
import { useLocation } from 'react-router'
import PricingCard from '../components/billing/PricingCard'
import SubscriptionPanel from '../components/billing/SubscriptionPanel'
import ScrollFade from '../components/common/ScrollFade'
import { controlNeutral } from '../components/common/controlStyles'
import TopBar from '../components/rightContainer/TopBar'
import { useActivationPolling } from '../hooks/useActivationPolling'
import { usePlan } from '../hooks/usePlan'
import { billingApi } from '../services/billingApi'
import { refreshProfile } from '../services/profileApi'
import { billingErrorText, billingView, isLiveStatus } from '../utils/billingView'

const card = 'mt-4 rounded-2xl border border-zinc-300 bg-white p-5 dark:border-white/[0.14] dark:bg-panel'

function Spinner() {
  return <span aria-hidden="true" className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-700/30 border-t-emerald-700 motion-reduce:animate-none dark:border-emerald-300/30 dark:border-t-emerald-300" />
}

/**
 * /billing and /billing/success (where checkout returns).
 * The plan always comes from the server. After checkout this page only watches GET /billing/status (the payment
 * webhook may lag by a few seconds); it never grants Pro itself.
 */
export default function BillingPage() {
  const { planState, loading } = usePlan()
  const [live, setLive] = useState(null) // the server's latest answer after a change made on this page
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState('')
  const justPaid = useLocation().pathname.endsWith('/success')

  const view = billingView(live ?? planState)
  const watching = justPaid && !loading && !view.live

  const handleActive = useCallback((state) => {
    setLive(state)
    refreshProfile()
  }, [])
  const activation = useActivationPolling({ enabled: watching, onActive: handleActive })

  // after the wait ran out: ask the server to re-read the subscription from the payment provider, then watch again
  const checkAgain = async () => {
    if (checking) return
    setChecking(true)
    setCheckError('')
    try {
      const data = await billingApi.sync()
      if (isLiveStatus(data?.status)) {
        handleActive(data)
        return
      }
    } catch (error) {
      setCheckError(billingErrorText(error))
    } finally {
      setChecking(false)
    }
    activation.restart()
  }

  return (
    <>
      <TopBar label="Account" title="Plan & billing" />
      <ScrollFade className="flex min-h-0 flex-1 flex-col" scrollClassName="subtle-scrollbar flex-1 overflow-y-auto p-3 sm:p-6 md:p-8">
        <section aria-labelledby="billing-title" className="mx-auto max-w-md">
          <h2 id="billing-title" className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">TradeCommit Pro</h2>

          {loading ? (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">Loading your plan…</p>
          ) : watching ? (
            <div role="status" className="mt-4 rounded-lg border border-emerald-700/30 bg-emerald-600/10 p-4 text-[13px] leading-5 text-emerald-900 dark:border-emerald-400/30 dark:text-emerald-200">
              {activation.phase === 'timeout' ? (
                <>
                  <p className="font-medium">This is taking longer than usual.</p>
                  <p className="mt-1">Your payment is safe. Pro turns on as soon as it is confirmed; you can also check again now.</p>
                  {checkError && <p role="alert" className="mt-2 text-rose-700 dark:text-rose-300">{checkError}</p>}
                  <button type="button" onClick={checkAgain} disabled={checking} className={`${controlNeutral} mt-3`}>
                    {checking ? 'Checking…' : 'Check again'}
                  </button>
                </>
              ) : (
                <p className="flex items-center gap-2.5 font-medium">
                  <Spinner />
                  Activating your Pro plan…
                </p>
              )}
            </div>
          ) : (
            <>
              {justPaid && view.live && (
                <div role="status" className="mt-4 rounded-lg border border-emerald-700/30 bg-emerald-600/10 p-3 text-[13px] leading-5 text-emerald-900 dark:border-emerald-400/30 dark:text-emerald-200">
                  Thanks! Your Pro plan is active.
                </div>
              )}
              <div className={card}>
                <SubscriptionPanel view={view} onState={setLive} />
              </div>
              {view.showUpgrade && (
                <div className={card}>
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
