import { useSyncExternalStore } from 'react'
import { toastStore } from '../../utils/toastStore'

// Renders the toast store. Mounted once in the app shell. Toasts slide in from the right, bottom-right and just
// above the form footer, so they never sit on top of the Save button. Not focusable: it announces politely and stays out of the way.
function ToastHost() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, toastStore.getSnapshot)

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed bottom-24 right-3 z-[95] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col items-end gap-2 sm:right-5">
      <style>{`
        @keyframes tc-toast-in { from { opacity: 0; transform: translateX(28px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes tc-toast-out { from { opacity: 1; transform: translateX(0) } to { opacity: 0; transform: translateX(28px) } }
        .tc-toast-in { animation: tc-toast-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both }
        .tc-toast-out { animation: tc-toast-out 180ms cubic-bezier(0.4, 0, 1, 1) both }
        @media (prefers-reduced-motion: reduce) { .tc-toast-in, .tc-toast-out { animation: none } }
      `}</style>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${toast.leaving ? 'tc-toast-out' : 'tc-toast-in'} pointer-events-auto flex max-w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] shadow-lg ${
            toast.tone === 'error'
              ? 'border-rose-200 bg-white text-zinc-800 dark:border-rose-400/20 dark:bg-panel dark:text-zinc-100'
              : 'border-zinc-200 bg-white text-zinc-800 dark:border-white/[0.14] dark:bg-panel dark:text-zinc-100'
          }`}
        >
          <span
            aria-hidden="true"
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              toast.tone === 'pending'
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300'
                : toast.tone === 'error'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300'
            }`}
          >
            {toast.tone === 'pending' ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : toast.tone === 'error' ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            )}
          </span>
          <span className="min-w-0 truncate font-medium">{toast.message}</span>
          {toast.detail && <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300">{toast.detail}</span>}
        </div>
      ))}
    </div>
  )
}

export default ToastHost
