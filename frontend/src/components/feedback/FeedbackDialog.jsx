import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, CloseIcon } from '../../utils/Icons.jsx'
import { SERIF } from '../auth/authStyles'
import { focusRing } from '../profile/profileStyles'
import BugReportFlow from './BugReportFlow'
import FeedbackFlow from './FeedbackFlow'
import { stepEnter } from './formParts'

const DONE_COPY = {
  feedback: 'Your feedback helps shape what TradeCommit becomes next.',
  bug: "We've got your report and will look into it.",
}

/**
 * A compact, onboarding-style dialog (not fullscreen): header, one step at a time, small footer.
 * Opened from the sidebar, or automatically (isAutoPrompt) after the user's 10th trade.
 * Rendered in a portal so the sidebar's overflow-hidden can't clip it.
 */
function FeedbackDialog({ onClose, isAutoPrompt = false }) {
  const [mode, setMode] = useState('feedback') // 'feedback' | 'bug'
  const [isBusy, setIsBusy] = useState(false)
  const [sentKind, setSentKind] = useState(null) // 'feedback' | 'bug' once something was sent

  useEffect(() => {
    const handleKeyDown = (event) => event.key === 'Escape' && !isBusy && onClose()
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isBusy, onClose])

  const isFeedback = mode === 'feedback'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && !isBusy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isFeedback ? 'Share your feedback' : 'Report a bug'}
        className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-2xl dark:border-white/[0.14] dark:bg-panel"
      >
        <header className="flex shrink-0 items-center justify-between px-7 pt-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-900 text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">T</span>
            <span className="text-sm font-medium tracking-[-0.01em] text-zinc-900 dark:text-zinc-100">{isFeedback ? 'Feedback' : 'Report a bug'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close"
            className={`-mr-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-zinc-200 ${focusRing}`}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="subtle-scrollbar min-h-[380px] flex-1 overflow-y-auto px-7 pb-6 pt-6">
          {sentKind ? (
            <div className={`flex min-h-[330px] flex-col items-center justify-center text-center ${stepEnter}`}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                <CheckIcon className="h-5 w-5" />
              </span>
              <h2 className={`${SERIF} mt-5 text-[28px] font-medium tracking-[-0.025em] text-zinc-900 dark:text-zinc-50`}>Thank you.</h2>
              <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-600 dark:text-zinc-400">{DONE_COPY[sentKind]}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-7 h-10 cursor-pointer rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Done
              </button>
            </div>
          ) : isFeedback ? (
            <FeedbackFlow isBusy={isBusy} onBusyChange={setIsBusy} onSent={() => setSentKind('feedback')} isAutoPrompt={isAutoPrompt} />
          ) : (
            <BugReportFlow isBusy={isBusy} onBusyChange={setIsBusy} onSent={() => setSentKind('bug')} />
          )}
        </div>

        {!sentKind && (
          <footer className="flex shrink-0 items-center justify-between border-t border-zinc-200 px-7 py-3 text-[11px] text-zinc-500 dark:border-white/[0.08]">
            <span>Private by default.</span>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setMode(isFeedback ? 'bug' : 'feedback')}
              className="cursor-pointer text-zinc-500 transition-colors hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-zinc-100"
            >
              {isFeedback ? 'Found a bug? Report it →' : '← Share feedback instead'}
            </button>
          </footer>
        )}
      </div>
    </div>,
    document.body
  )
}

export default FeedbackDialog
