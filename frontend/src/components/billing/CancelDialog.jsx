import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { focusRing } from '../common/controlStyles'

/** Confirms cancelling at the end of the paid period. Nothing is cancelled until the person presses the button. */
export default function CancelDialog({ until, busy, error, onConfirm, onClose }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
    const onKeyDown = (event) => event.key === 'Escape' && !busy && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        aria-describedby="cancel-body"
        className="w-full max-w-sm rounded-2xl border border-zinc-300 bg-white p-5 shadow-2xl outline-none dark:border-white/[0.14] dark:bg-panel"
      >
        <h2 id="cancel-title" className="text-base font-semibold tracking-[-0.02em] text-zinc-900 dark:text-zinc-50">Cancel your subscription?</h2>
        <p id="cancel-body" className="mt-2 text-[13px] leading-6 text-zinc-600 dark:text-zinc-300">
          {until ? `You keep Pro until ${until}.` : 'You keep Pro until the end of your paid period.'} Your data stays; extra journals/planners become read-only.
        </p>
        {error && <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={`h-9 cursor-pointer rounded-md px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-white/10 ${focusRing}`}>
            Keep Pro
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`h-9 cursor-pointer rounded-md bg-rose-700 px-4 text-xs font-medium text-white hover:bg-rose-800 disabled:cursor-wait disabled:opacity-60 ${focusRing}`}>
            {busy ? 'Cancelling…' : 'Cancel subscription'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
