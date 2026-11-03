import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../../utils/Icons.jsx'
import { PLAN_LIMIT_EVENT } from '../../utils/http'
import { upgradeCopy } from '../../utils/upgrade'
import { UPGRADE_REQUESTED_EVENT } from '../../utils/upgradePrompt'
import PricingCard from '../billing/PricingCard'
import { focusRing } from './controlStyles'

/**
 * The one upgrade prompt: why the person was stopped, then the shared pricing card (monthly / yearly, display
 * prices, what Pro adds, Upgrade). The card starts the checkout and sends only the interval; the server picks the
 * product and Dodo picks the amount.
 */
export default function UpgradeModal({ feature, onClose }) {
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef(null)
  const { title, body } = upgradeCopy(feature)

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
    const onKeyDown = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-zinc-300 bg-white p-5 shadow-2xl outline-none dark:border-white/[0.14] dark:bg-panel"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#b95b3b] dark:text-[#e08a68]">TradeCommit Pro</p>
            <h2 id="upgrade-title" className="mt-1 text-base font-semibold tracking-[-0.02em] text-zinc-900 dark:text-zinc-50">{title}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10 ${focusRing}`}>
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 mb-4 text-[13px] leading-6 text-zinc-600 dark:text-zinc-300">{body}</p>

        <PricingCard
          onBusyChange={setBusy}
          secondaryAction={
            <button type="button" onClick={onClose} disabled={busy} className={`h-9 cursor-pointer rounded-md px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10 ${focusRing}`}>Not now</button>
          }
        />
      </div>
    </div>,
    document.body
  )
}

/**
 * Mounted once: opens the modal when a request hits a plan limit, when a component calls openUpgrade(), or when a
 * locked analytics section asks for an upgrade (requestUpgrade).
 */
export function UpgradeHost() {
  const [feature, setFeature] = useState(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onLimit = (event) => {
      setFeature(event.detail?.feature ?? null)
      setOpen(true)
    }
    // locked analytics sections announce the metric id they stand for: the modal explains analytics as a whole
    const onRequested = () => {
      setFeature('analytics')
      setOpen(true)
    }
    window.addEventListener(PLAN_LIMIT_EVENT, onLimit)
    window.addEventListener(UPGRADE_REQUESTED_EVENT, onRequested)
    return () => {
      window.removeEventListener(PLAN_LIMIT_EVENT, onLimit)
      window.removeEventListener(UPGRADE_REQUESTED_EVENT, onRequested)
    }
  }, [])
  return open ? <UpgradeModal feature={feature} onClose={() => setOpen(false)} /> : null
}
