import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../../utils/Icons.jsx'
import { PLAN_LIMIT_EVENT, requestJson } from '../../utils/http'
import { upgradeCopy } from '../../utils/upgrade'
import { focusRing } from './controlStyles'

const INTERVALS = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' }
]
const FALLBACK_URL = import.meta.env.VITE_UPGRADE_URL

/**
 * The one upgrade prompt. Starts a checkout (POST /api/v1/billing/checkout) and sends the browser to the url the
 * server returns. The server picks the product and price; the client only says monthly or yearly.
 * Until billing exists (404) it falls back to VITE_UPGRADE_URL.
 */
export default function UpgradeModal({ feature, onClose }) {
  const [interval, setInterval] = useState('monthly')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)
  const { title, body } = upgradeCopy(feature)

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
    const onKeyDown = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const upgrade = async () => {
    if (busy) return
    setBusy(true)
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
      setBusy(false)
    }
  }

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
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10 ${focusRing}`}>
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-[13px] leading-6 text-zinc-600 dark:text-zinc-300">{body}</p>

        <div role="radiogroup" aria-label="Billing period" className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-white/[0.06]">
          {INTERVALS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={interval === item.id}
              onClick={() => setInterval(item.id)}
              className={`h-8 cursor-pointer rounded-md text-xs font-medium transition-colors ${focusRing} ${interval === item.id ? 'bg-white text-zinc-900 shadow-sm dark:bg-white/[0.14] dark:text-zinc-50' : 'text-zinc-600 dark:text-zinc-400'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={`h-9 cursor-pointer rounded-md px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10 ${focusRing}`}>Not now</button>
          <button type="button" onClick={upgrade} disabled={busy} className={`h-9 cursor-pointer rounded-md bg-zinc-900 px-4 text-xs font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 ${focusRing}`}>
            {busy ? 'Opening checkout…' : 'Upgrade'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/** Mounted once: opens the modal whenever any request hits a plan limit or a component calls openUpgrade(). */
export function UpgradeHost() {
  const [feature, setFeature] = useState(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onLimit = (event) => {
      setFeature(event.detail?.feature ?? null)
      setOpen(true)
    }
    window.addEventListener(PLAN_LIMIT_EVENT, onLimit)
    return () => window.removeEventListener(PLAN_LIMIT_EVENT, onLimit)
  }, [])
  return open ? <UpgradeModal feature={feature} onClose={() => setOpen(false)} /> : null
}
