import { usePwa } from '../../hooks/usePwa'
import { CloseIcon, DownloadIcon } from '../../utils/Icons.jsx'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 dark:focus-visible:ring-zinc-500'

/**
 * Compact, dismissible install pill for standalone pages outside the main sidebar shell
 * (such as /auth, /onboarding, and legal/support pages).
 * Respects standalone/installed state and user dismissal.
 */
function PwaInstallButton({ className = '' }) {
  const { showInstallNudge, isPromptingInstall, requestInstall, dismissInstallEntry } = usePwa()

  if (!showInstallNudge) return null

  return (
    <div
      className={`inline-flex items-center rounded-full border border-zinc-300/85 bg-white/60 text-[11px] font-semibold text-zinc-700 shadow-2xs backdrop-blur-sm transition-colors dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-zinc-200 ${className}`}
    >
      <button
        type="button"
        disabled={isPromptingInstall}
        onClick={() => requestInstall()}
        title="Install TradeCommit as an app"
        className={`inline-flex h-7 items-center gap-1.5 rounded-l-full pl-2.5 pr-1.5 transition-colors hover:text-zinc-950 disabled:opacity-60 dark:hover:text-white ${focusRing}`}
      >
        <DownloadIcon className="h-3.5 w-3.5 shrink-0" />
        <span>Install app</span>
      </button>
      <button
        type="button"
        onClick={dismissInstallEntry}
        aria-label="Dismiss install app option"
        title="Dismiss"
        className={`inline-flex h-7 w-6 items-center justify-center rounded-r-full pr-1 text-zinc-400 transition-colors hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200 ${focusRing}`}
      >
        <CloseIcon className="h-3 w-3" />
      </button>
    </div>
  )
}

export default PwaInstallButton
