import { useEffect } from 'react'
import { usePwa } from '../../hooks/usePwa'
import { initPwaClient } from '../../utils/pwa'
import { CloseIcon } from '../../utils/Icons.jsx'
import PwaInstallDialog from './PwaInstallDialog'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 dark:focus-visible:ring-zinc-500'

/**
 * Mounted once at the application root (main.jsx).
 * Manages service-worker registration in production, displays the non-disruptive waiting-worker
 * update banner with explicit Update and Dismiss actions, surfaces offline connectivity status,
 * and hosts the platform installation instructions modal.
 */
function PwaShell() {
  const {
    updateAvailable,
    updateDismissed,
    isApplyingUpdate,
    applyUpdate,
    dismissUpdate,
    isOffline,
    offlineDismissed,
    dismissOffline,
  } = usePwa()

  useEffect(() => {
    initPwaClient()
  }, [])

  const showUpdateBanner = updateAvailable && !updateDismissed
  const showOfflineBanner = isOffline && !offlineDismissed

  return (
    <>
      {(showUpdateBanner || showOfflineBanner) && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-4 right-3 z-[96] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col items-end gap-2 sm:bottom-5 sm:right-5"
        >
          {showOfflineBanner && (
            <div
              role="status"
              className="pointer-events-auto flex w-full items-center justify-between gap-2.5 rounded-xl border border-amber-300/80 bg-white px-3.5 py-2.5 text-[12.5px] text-zinc-800 shadow-lg dark:border-amber-400/25 dark:bg-panel-hi dark:text-zinc-100"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400"
                />
                <span className=" leading-snug">
                  <strong className="font-semibold">Offline</strong> · Live journal and account data requires a connection.
                </span>
              </div>
              <button
                type="button"
                onClick={dismissOffline}
                aria-label="Dismiss offline notice"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-white/[0.08] dark:hover:text-zinc-200 ${focusRing}`}
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {showUpdateBanner && (
            <div
              role="region"
              aria-label="Application update available"
              className="pointer-events-auto w-full rounded-xl border border-zinc-300 bg-white p-3.5 text-zinc-800 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.22)] dark:border-white/[0.14] dark:bg-panel-hi dark:text-zinc-100"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/favicon.svg"
                    alt=""
                    aria-hidden="true"
                    className="h-6 w-6 shrink-0 rounded-md object-contain"
                  />
                  <div>
                    <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                      Update available
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-zinc-600 dark:text-zinc-300">
                      A new version of TradeCommit is ready. Reload when you&apos;ve saved your work.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isApplyingUpdate}
                  onClick={dismissUpdate}
                  aria-label="Dismiss update notification"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50 dark:hover:bg-white/[0.08] dark:hover:text-zinc-200 ${focusRing}`}
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isApplyingUpdate}
                  onClick={dismissUpdate}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100 ${focusRing}`}
                >
                  Later
                </button>
                <button
                  type="button"
                  disabled={isApplyingUpdate}
                  onClick={applyUpdate}
                  className={`rounded-md bg-zinc-900 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${focusRing}`}
                >
                  {isApplyingUpdate ? 'Updating…' : 'Update'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <PwaInstallDialog />
    </>
  )
}

export default PwaShell
