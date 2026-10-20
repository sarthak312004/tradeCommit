import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../../../utils/Icons.jsx'
import { getAiQuota } from '../../../services/aiReviewApi'
import { focusRing } from '../../common/controlStyles'
import SparklesIcon from './SparklesIcon'
import RangeReviewPanel from './RangeReviewPanel'
import ReviewHistoryPanel from './ReviewHistoryPanel'
import { allowanceText } from './reviewParts'

const MODES = [
  { id: 'review', label: 'Review' },
  { id: 'history', label: 'History' }
]

/**
 * The AI mentor, in two tabs: ask for a review of any period, and browse every past review (old weekly reviews
 * included). There is one way to ask: pick a period (This week, Last week, This month, Last 30 days, All trades, or custom
 * dates). Opening it (or browsing) only loads what is saved and never spends AI quota. A new review is written only when
 * the trader presses the button, and the server unlocks that button when the period holds at least 5 trades and the trader
 * is within the allowance (1 a day, 3 a week), so the shared free-tier quota stretches across many traders.
 * The Review tab stays mounted once opened, so a review being written is never lost when you look at the history.
 * Rendered in a portal because the page header uses backdrop-blur, which would trap `fixed` children.
 */
function AiMentorDialog({ journalId, journalName, currency, isOpen, onClose, onOpenContext, onAddTrade, onReviewReady, initialRange = null, earliestTradeDate = null }) {
  const [mode, setMode] = useState('review') // 'review' | 'history'
  // dates handed to the Review tab when a review is reopened from the history
  const [rangeSeed, setRangeSeed] = useState(null)
  const [rangeKey, setRangeKey] = useState(0)
  const [quota, setQuota] = useState(null)
  const dialogRef = useRef(null)

  // every response carries the allowance as the server sees it right now; the newest one wins
  const reportAccess = useCallback((access) => {
    if (access?.quota) setQuota(access.quota)
  }, [])

  const refreshQuota = useCallback(async () => {
    try {
      setQuota(await getAiQuota(journalId))
    } catch (quotaError) {
      console.error('Could not refresh the review allowance:', quotaError)
    }
  }, [journalId])

  useEffect(() => {
    if (!isOpen) return undefined
    dialogRef.current?.focus({ preventScroll: true })
    const handleKeyDown = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    let cancelled = false
    getAiQuota(journalId)
      .then((next) => {
        if (!cancelled) setQuota(next)
      })
      .catch((quotaError) => {
        console.error('Could not refresh the review allowance:', quotaError)
      })
    return () => { cancelled = true }
  }, [journalId])

  const selectMode = (next) => {
    // the Review tab stays mounted while hidden, so stop any read-aloud explicitly when leaving a tab
    if (next !== mode) window.speechSynthesis?.cancel()
    setMode(next)
    if (next === 'review') refreshQuota()
  }

  // a past review that needs updating (weekly ones too) reopens in the Review tab on its own dates
  const openFromHistory = (item) => {
    window.speechSynthesis?.cancel()
    setRangeSeed({ from: item.start, to: item.end })
    setRangeKey((value) => value + 1) // a fresh Review tab for the dates being reopened
    setMode('review')
    refreshQuota()
  }

  const allowance = allowanceText(quota?.usage)

  return createPortal(
    <div hidden={!isOpen} aria-hidden={!isOpen} inert={!isOpen} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px] sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Mentor review"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-2xl outline-none dark:border-white/[0.14] dark:bg-panel"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100">
              <SparklesIcon className="h-[18px] w-[18px]" />
              <h3 className="text-lg font-semibold tracking-[-0.03em]">Mentor review</h3>
            </div>
            <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{journalName}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200 ${focusRing}`}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        <div role="tablist" aria-label="Mentor sections" className="flex shrink-0 gap-1 border-b border-zinc-200 px-8 dark:border-white/[0.08]">
          {MODES.map((item) => {
            const active = mode === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectMode(item.id)}
                className={`inline-flex h-10 cursor-pointer items-center whitespace-nowrap border-b-2 px-3.5 text-[13px] font-medium transition-colors ${focusRing} ${
                  active
                    ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50'
                    : 'border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {/* the only scroller in the dialog; its thumb shows on hover, and nothing inside it scrolls sideways */}
        <div className="quiet-scrollbar min-h-[360px] flex-1 overflow-y-auto overflow-x-hidden px-8 pb-8">
          <div className="pt-6">
            <div hidden={mode !== 'review'}>
              <RangeReviewPanel
                key={rangeKey}
                journalId={journalId}
                currency={currency}
                seed={rangeSeed}
                journalRange={initialRange}
                earliestTradeDate={earliestTradeDate}
                onOpenContext={onOpenContext}
                onAddTrade={onAddTrade}
                quota={quota}
                onAccess={reportAccess}
                onRefreshQuota={refreshQuota}
                onReviewReady={onReviewReady}
              />
            </div>
            {mode === 'history' && <ReviewHistoryPanel journalId={journalId} currency={currency} onUpdate={openFromHistory} />}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-zinc-200 px-8 py-3.5 text-[11px] text-zinc-500 dark:border-white/[0.08] dark:text-zinc-400">
          <span className="min-w-0 truncate">AI feedback from your own logs, not financial advice.</span>
          {mode === 'review' && allowance && (
            <span className="shrink-0 tabular-nums" title="You can write 1 review a day and 3 a week. Looking at saved reviews is free.">
              {allowance}
            </span>
          )}
        </footer>
      </div>
    </div>,
    document.body
  )
}

export default AiMentorDialog
