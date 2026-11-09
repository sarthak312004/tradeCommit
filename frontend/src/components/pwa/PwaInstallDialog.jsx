import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePwa } from '../../hooks/usePwa'
import { CloseIcon, DownloadIcon } from '../../utils/Icons.jsx'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 dark:focus-visible:ring-zinc-500'

function PwaInstallDialog() {
  const {
    isInstallDialogOpen,
    closeInstallDialog,
    dismissInstallEntry,
    canPromptNatively,
    isPromptingInstall,
    requestInstall,
    platform,
  } = usePwa()
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!isInstallDialogOpen) return undefined
    const opener = document.activeElement
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeInstallDialog()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    if (dialogRef.current && !dialogRef.current.contains(document.activeElement)) {
      dialogRef.current.focus({ preventScroll: true })
    }
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (opener instanceof HTMLElement) opener.focus({ preventScroll: true })
    }
  }, [isInstallDialogOpen, closeInstallDialog])

  if (!isInstallDialogOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[98] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-[1px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeInstallDialog()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-title"
        aria-describedby="pwa-install-desc"
        tabIndex={-1}
        className="tc-modal-enter w-full max-w-[400px] rounded-2xl border border-zinc-300 bg-white p-5 text-zinc-900 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.35)] outline-none dark:border-white/[0.13] dark:bg-panel-hi dark:text-zinc-100"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/favicon.svg"
              alt="TradeCommit logo"
              className="h-10 w-10 shrink-0 rounded-xl object-contain shadow-xs"
            />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {platform.osLabel} · {platform.browserLabel}
              </p>
              <h2 id="pwa-install-title" className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {platform.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={closeInstallDialog}
            aria-label="Close install instructions"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100 ${focusRing}`}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <p id="pwa-install-desc" className="mt-3 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
          {platform.summary}
        </p>

        {canPromptNatively ? (
          <div className="mt-4">
            <button
              type="button"
              disabled={isPromptingInstall}
              onClick={() => requestInstall()}
              className={`flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${focusRing}`}
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              {isPromptingInstall ? 'Opening install prompt…' : 'Install TradeCommit'}
            </button>
          </div>
        ) : (
          <ol className="mt-4 space-y-2.5 rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-3.5 text-[12.5px] leading-snug text-zinc-700 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-200">
            {platform.steps.map((step, index) => (
              <li key={step} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-200/90 font-mono text-[10px] font-semibold text-zinc-700 dark:bg-white/[0.12] dark:text-zinc-200">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-zinc-200/80 pt-3.5 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={dismissInstallEntry}
            className={`rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200 ${focusRing}`}
          >
            Don&apos;t show again
          </button>
          <button
            type="button"
            onClick={closeInstallDialog}
            className={`rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${focusRing}`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default PwaInstallDialog
