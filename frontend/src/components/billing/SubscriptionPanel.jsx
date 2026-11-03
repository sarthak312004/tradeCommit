import { useState } from 'react'
import { billingApi } from '../../services/billingApi'
import { refreshProfile } from '../../services/profileApi'
import { billingErrorText } from '../../utils/billingView'
import { badgeBase, badgeTone, controlNeutral, controlPrimary } from '../common/controlStyles'
import CancelDialog from './CancelDialog'

/**
 * Current subscription: status, renewal / end date, and the self-service actions (portal, cancel, resume, refresh).
 * `view` comes from billingView(); `onState(planState)` receives the server's answer after a change.
 */
export default function SubscriptionPanel({ view, onState }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirming, setConfirming] = useState(false)

  const run = async (name, action, { done = '', onError } = {}) => {
    if (busy) return false
    setBusy(name)
    setError('')
    setNotice('')
    try {
      const data = await action()
      if (done) setNotice(done)
      return data ?? true
    } catch (requestError) {
      const message = billingErrorText(requestError)
      if (onError) onError(message)
      else setError(message)
      return false
    } finally {
      setBusy('')
    }
  }

  const adopt = (data) => {
    if (data && typeof data === 'object' && data.status) onState(data)
    refreshProfile() // entitlements follow the server's state
  }

  const openPortal = async () => {
    const data = await run('portal', () => billingApi.portal())
    if (data?.url) window.location.assign(data.url)
  }

  const cancel = async () => {
    const data = await run('cancel', () => billingApi.cancel(), { onError: setError })
    if (!data) return
    setConfirming(false)
    adopt(data)
    setNotice('Cancellation scheduled. You keep Pro until the end of your paid period.')
  }

  const resume = async () => {
    const data = await run('resume', () => billingApi.resume(), { done: 'Welcome back. Your subscription will renew as usual.' })
    if (data) adopt(data)
  }

  const sync = async () => {
    const data = await run('sync', () => billingApi.sync(), { done: 'Billing status is up to date.' })
    if (data) adopt(data)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${badgeBase} ${badgeTone[view.badge.tone]}`}>{view.badge.label}</span>
        {view.intervalLabel && view.live && <span className="text-xs text-zinc-600 dark:text-zinc-300">{view.intervalLabel} plan</span>}
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{view.summary}</p>

      {view.showPastDueBanner && (
        <div role="alert" className="mt-3 rounded-lg border border-rose-700/30 bg-rose-600/10 p-3 text-[13px] leading-5 text-rose-900 dark:border-rose-400/30 dark:text-rose-200">
          <p>Update your payment method so Pro does not stop.</p>
          <button type="button" onClick={openPortal} disabled={Boolean(busy)} className={`${controlPrimary} mt-2`}>
            {busy === 'portal' ? 'Opening…' : 'Update payment method'}
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {view.showPortal && !view.showPastDueBanner && (
          <button type="button" onClick={openPortal} disabled={Boolean(busy)} className={controlNeutral}>
            {busy === 'portal' ? 'Opening…' : 'Manage payment & invoices'}
          </button>
        )}
        {view.showPastDueBanner && (
          <button type="button" onClick={openPortal} disabled={Boolean(busy)} className={controlNeutral}>Invoices & billing history</button>
        )}
        {view.canResume && (
          <button type="button" onClick={resume} disabled={Boolean(busy)} className={controlPrimary}>
            {busy === 'resume' ? 'Resuming…' : 'Resume subscription'}
          </button>
        )}
        {view.canCancel && (
          <button type="button" onClick={() => { setError(''); setConfirming(true) }} disabled={Boolean(busy)} className={controlNeutral}>
            Cancel subscription
          </button>
        )}
      </div>

      {view.showSync && (
        <p className="mt-3 text-[11px] leading-4 text-zinc-600 dark:text-zinc-300">
          Something look out of date?{' '}
          <button type="button" onClick={sync} disabled={Boolean(busy)} className="cursor-pointer font-medium underline underline-offset-2 disabled:cursor-wait disabled:opacity-60">
            {busy === 'sync' ? 'Refreshing…' : 'Refresh billing status'}
          </button>
        </p>
      )}

      <div aria-live="polite">
        {notice && <p className="mt-3 text-xs text-emerald-800 dark:text-emerald-300">{notice}</p>}
        {error && !confirming && <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </div>

      {confirming && (
        <CancelDialog until={view.until} busy={busy === 'cancel'} error={error} onConfirm={cancel} onClose={() => { setConfirming(false); setError('') }} />
      )}
    </div>
  )
}
