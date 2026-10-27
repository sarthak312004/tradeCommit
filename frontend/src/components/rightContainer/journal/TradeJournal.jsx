import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import JournalCalendar from './JournalCalendar'
import TradeCard from './TradeCard'
import TradeTable from './TradeTable'
import TradeViewToggle from './TradeViewToggle'
import DateRangeFilter from './DateRangeFilter'
import JournalActionsMenu from './JournalActionsMenu'
import MentorOrb from './MentorOrb'
import MentorUnlockBadge from './MentorUnlockBadge'
import { useMentorProgress } from '../../../hooks/useMentorProgress'
import { CalendarNudge, EmptyWorkspace, FirstTradeCard } from '../../onboarding/GetStarted'
import { ALL_TIME, describeRangeInline, isRangeActive } from '../../../utils/dateRange'
import { filterTradesByDate, sortTradesNewestFirst, toDateKey } from '../../../utils/tradeAnalytics'
import { DEFAULT_CURRENCY } from '../../../utils/currencies'
import { buildTemplateFields, hasJournalContext } from '../../../utils/customFields'
import { buildFieldChoices, collectCustomFieldOptions, resolveCardFields } from '../../../utils/tradeCardFields'
import { useTradeCardFields } from '../../../hooks/useTradeCardFields'
import { useTradeView } from '../../../hooks/useTradeView'
import { SlidersIcon } from '../../../utils/Icons.jsx'
import { loadTradeForm, preloadTradeForm } from '../../../utils/formLoaders'
import DialogSkeleton from '../../common/DialogSkeleton'

// loaded on demand so the first paint ships less JavaScript
const TradeForm = lazy(loadTradeForm)
const TradeAnalysis = lazy(() => import('./TradeAnalysis'))
const JournalContextDialog = lazy(() => import('./JournalContextDialog'))
const ExportJournalDialog = lazy(() => import('./ExportJournalDialog'))
const ImportTradesDialog = lazy(() => import('./import/ImportTradesDialog'))
// the mentor is reachable from every tab, so its code is warmed up when the orb is hovered or focused
const loadAiMentor = () => import('./AiMentorDialog')
const AiMentorDialog = lazy(loadAiMentor)

const VIEWS = [
  { id: 'trades', label: 'Trades', path: '/' },
  { id: 'calendar', label: 'Calendar', path: '/calendar' },
  { id: 'analysis', label: 'Analysis', path: '/analysis' }
]

function AnalysisLoading() {
  return (
    <div
      aria-busy="true"
      className="tc-surface rounded-2xl border border-zinc-300 bg-white shadow-card dark:border-white/[0.12] dark:bg-panel dark:shadow-none"
    >
      <span role="status" className="sr-only">Loading analysis…</span>
      <div aria-hidden="true" className="p-5 pb-3 sm:p-6 sm:pb-4">
        <div className="h-3 w-16 animate-pulse rounded bg-zinc-200 dark:bg-white/[0.08]" />
        <div className="mt-2 h-8 w-32 animate-pulse rounded bg-zinc-200 dark:bg-white/[0.08]" />
        <div className="mt-2 h-3 w-40 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.05]" />
      </div>
      <div aria-hidden="true" className="px-3 pb-4 sm:px-4">
        <div className="h-52 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/[0.04]" />
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-6 border-t border-zinc-300 p-5 sm:grid-cols-3 sm:p-6 md:grid-cols-5 dark:border-white/[0.12]">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index}>
            <div className="h-3 w-20 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.05]" />
            <div className="mt-2 h-6 w-24 animate-pulse rounded bg-zinc-200 dark:bg-white/[0.08]" />
            <div className="mt-2 h-3 w-28 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.05]" />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="grid gap-x-12 gap-y-6 border-t border-zinc-300 p-5 sm:p-6 md:grid-cols-2 dark:border-white/[0.12]">
        {[0, 1].map((group) => (
          <div key={group}>
            <div className="mb-3 h-3 w-24 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.05]" />
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex justify-between border-b border-zinc-200 py-3 dark:border-white/[0.06]">
                <div className="h-3 w-28 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.05]" />
                <div className="h-3 w-16 animate-pulse rounded bg-zinc-200 dark:bg-white/[0.08]" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function TradeJournal({ view = 'trades', journal, journals = [], onImportTrades, onOpenJournal, onAddTrade, onUpdateTrade, onDeleteTrade, onUploadTradeImage, onSaveContext, onRetryTrade, onDiscardTrade, onOpenCreateForm }) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTrade, setEditingTrade] = useState(null)
  const navigate = useNavigate()
  // date picked on the calendar for a new trade (null = form opens on today)
  const [newTradeDate, setNewTradeDate] = useState(null)
  const [range, setRange] = useState(ALL_TIME)
  const [isContextOpen, setIsContextOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const importHintKey = journal?.id ? `tradecommit:import-hint:${journal.id}` : null
  const [isImportHintDismissed, setIsImportHintDismissed] = useState(() =>
    !importHintKey || window.localStorage.getItem(importHintKey) === '1'
  )
  const showImportHint = Boolean(
    journal?.createdInSession &&
    !isImportHintDismissed &&
    (journal?.trades?.length ?? 0) === 0 &&
    onImportTrades
  )
  const [isMentorOpen, setIsMentorOpen] = useState(false)
  const [isMentorMounted, setIsMentorMounted] = useState(false)
  const [hasReadyMentorReview, setHasReadyMentorReview] = useState(false)

  const openMentor = useCallback(() => {
    setHasReadyMentorReview(false)
    setIsMentorMounted(true)
    setIsMentorOpen(true)
  }, [])

  const closeMentor = useCallback(() => {
    setIsMentorOpen(false)
  }, [])

  const handleMentorReviewReady = useCallback(() => {
    setHasReadyMentorReview(true)
  }, [])

  const dismissImportHint = () => {
    if (importHintKey) window.localStorage.setItem(importHintKey, '1')
    setIsImportHintDismissed(true)
  }

  // Start loading the form as soon as the journal is mounted, so an immediate first click is ready.
  useEffect(() => {
    preloadTradeForm()
  }, [])

  const allTrades = journal?.trades
  // trades that reached the server (not still saving or failed): drives the unlock progress on the mentor orb
  const savedTradeCount = useMemo(() => (allTrades ?? []).filter((trade) => !trade.syncState).length, [allTrades])
  const { progress: mentorProgress, celebrate: celebrateMentor } = useMentorProgress(savedTradeCount)
  // the mentor's "All trades" period starts at this journal's first trade
  const earliestTradeDate = useMemo(() => {
    let earliest = null
    for (const trade of allTrades ?? []) {
      if (trade.syncState) continue
      const key = toDateKey(trade.date)
      if (key && (!earliest || key < earliest)) earliest = key
    }
    return earliest
  }, [allTrades])
  // newest first, so a trade you just logged is the first card
  const visibleTrades = useMemo(() => sortTradesNewestFirst(filterTradesByDate(allTrades ?? [], range)), [allTrades, range])

  // new trades start with the journal's default properties, plus any extras from the most recent trade
  const journalContext = journal?.context
  const templateFields = useMemo(() => buildTemplateFields(journalContext, allTrades ?? []), [journalContext, allTrades])

  // the details (max 3) a trade chip shows when hovered: edited with the pencil on the chip, remembered in this browser
  const [cardFieldIds, setCardFieldIds] = useTradeCardFields()
  // table (default) or cards, remembered in this browser
  const [tradeLayout, setTradeLayout] = useTradeView()
  const customFieldOptions = useMemo(() => collectCustomFieldOptions(allTrades ?? [], journalContext?.attributes ?? []), [allTrades, journalContext])
  const cardFields = useMemo(() => resolveCardFields(cardFieldIds, customFieldOptions), [cardFieldIds, customFieldOptions])
  // everything the trade form has, offered by the pencil on every chip (one shared choice for all of them)
  const fieldChoices = useMemo(() => buildFieldChoices(customFieldOptions), [customFieldOptions])

  const handleOpenNewTrade = (date = null) => {
    setEditingTrade(null)
    setNewTradeDate(typeof date === 'string' ? date : null)
    setIsFormOpen(true)
  }

  const handleOpenEditTrade = (trade) => {
    if (trade.syncState) return // still saving, or failed: use the card's Retry / Discard instead
    setEditingTrade(trade)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setEditingTrade(null)
    setNewTradeDate(null)
    setIsFormOpen(false)
  }

  // The form closes right away. The card shows up (or updates) immediately and the save finishes in the
  // background; if it fails, the card offers Retry / Discard. `options.prepare` finishes screenshot uploads.
  const handleSubmitTrade = (trade, options) => {
    if (editingTrade) return onUpdateTrade(journal.id, editingTrade.id, trade, options)
    dismissImportHint()
    return onAddTrade(journal.id, trade, options)
  }

  if (!journal) {
    return <EmptyWorkspace onCreate={onOpenCreateForm} />
  }

  if (journal.syncState === 'saving') {
    return (
      <section aria-busy="true" className="rounded-xl border border-zinc-200 bg-white/75 p-6 shadow-card dark:border-white/[0.10] dark:bg-panel/75 dark:shadow-none">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-white/20 dark:border-t-zinc-200" />
          <div>
            <p role="status" className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Creating {journal.name}…</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Your journal will be ready in a moment.</p>
          </div>
        </div>
      </section>
    )
  }

  const currency = journal.currency ?? DEFAULT_CURRENCY
  const isFiltered = isRangeActive(range)
  const subtitle = isFiltered
    ? `${visibleTrades.length} of ${journal.trades.length} trades, ${describeRangeInline(range)}`
    : `Trades in ${journal.name} (${currency})`

  return (
    <section className="pb-20">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-[-0.05em]">{view === 'analysis' ? 'Analysis' : view === 'calendar' ? 'Trade calendar' : 'Recent trades'}</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Journal view" data-tour="journal-views" className="inline-flex h-8 items-center rounded-lg border border-zinc-300 bg-white p-0.5 shadow-sm dark:border-white/[0.14] dark:bg-panel dark:shadow-none">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={view === item.id}
                onClick={() => navigate(item.path)}
                className={`h-full cursor-pointer rounded-md px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 ${
                  view === item.id
                    ? 'bg-zinc-900 text-white dark:bg-white/10 dark:text-zinc-100'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {view === 'trades' && <TradeViewToggle value={tradeLayout} onChange={setTradeLayout} />}

          <DateRangeFilter range={range} onChange={setRange} />

          <button
            type="button"
            onClick={() => setIsContextOpen(true)}
            data-tour="journal-context"
            title="Strategy and default trade properties"
            className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 dark:border-white/[0.14] dark:bg-panel dark:text-zinc-200 dark:shadow-none dark:hover:bg-white/[0.06]"
          >
            <SlidersIcon className="h-3.5 w-3.5" />
            Context
            {hasJournalContext(journalContext) && <span aria-label="Context added" className="h-1.5 w-1.5 rounded-full bg-sky-500" />}
          </button>

          <button
            type="button"
            onClick={isFormOpen ? handleCloseForm : () => handleOpenNewTrade()}
            onPointerEnter={preloadTradeForm}
            onFocus={preloadTradeForm}
            data-tour="add-trade"
            className="tc-btn-primary h-8 cursor-pointer rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white transition hover:bg-sky-600"
          >
            + Add trade
          </button>

          <div className="relative">
            <JournalActionsMenu
              onImport={onImportTrades ? () => {
                dismissImportHint()
                setIsImportOpen(true)
              } : undefined}
              onExport={() => setIsExportOpen(true)}
              onMenuOpen={dismissImportHint}
            />
            {showImportHint && (
              <div
                role="status"
                className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-sky-200 bg-white p-3 shadow-lg dark:border-sky-400/25 dark:bg-panel-hi"
              >
                <span aria-hidden="true" className="absolute -top-1.5 right-3 h-3 w-3 rotate-45 border-l border-t border-sky-200 bg-white dark:border-sky-400/25 dark:bg-panel-hi" />
                <button
                  type="button"
                  onClick={dismissImportHint}
                  aria-label="Dismiss import tip"
                  className="absolute right-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100"
                >
                  <span aria-hidden="true">×</span>
                </button>
                <p className="pr-5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">Already have trades?</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Import your trade history from a CSV or Excel file using this menu.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    dismissImportHint()
                    setIsImportOpen(true)
                  }}
                  className="mt-2 cursor-pointer text-xs font-semibold text-sky-800 underline-offset-2 hover:underline dark:text-sky-300"
                >
                  Import trades
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isContextOpen && (
        <Suspense fallback={<DialogSkeleton variant="context" />}>
          <JournalContextDialog
            journalId={journal.id}
            journalName={journal.name}
            context={journalContext}
            mode={journal.mode}
            onSave={(context, options) => onSaveContext(journal.id, context, options)}
            onClose={() => setIsContextOpen(false)}
          />
        </Suspense>
      )}

      {isMentorMounted && (
        <Suspense fallback={<DialogSkeleton variant="mentor" />}>
          <AiMentorDialog
            key={journal.id}
            journalId={journal.id}
            journalName={journal.name}
            currency={currency}
            isOpen={isMentorOpen}
            onReviewReady={handleMentorReviewReady}
            initialRange={isFiltered ? range : null}
            earliestTradeDate={earliestTradeDate}
            onClose={closeMentor}
            onAddTrade={() => {
              closeMentor()
              handleOpenNewTrade()
            }}
            onOpenContext={() => {
              closeMentor()
              setIsContextOpen(true)
            }}
          />
        </Suspense>
      )}

      {isExportOpen && (
        <Suspense fallback={null}>
          <ExportJournalDialog journal={journal} onClose={() => setIsExportOpen(false)} />
        </Suspense>
      )}

      {isImportOpen && (
        <Suspense fallback={null}>
          <ImportTradesDialog
            // journals still being created have no server id yet, so they cannot receive trades
            journals={journals.filter((item) => !item.syncState)}
            currentJournalId={journal.id}
            onImport={onImportTrades}
            onOpenJournal={(id) => {
              setIsImportOpen(false)
              onOpenJournal?.(id)
            }}
            onClose={() => setIsImportOpen(false)}
          />
        </Suspense>
      )}

      {isFormOpen && (
        <Suspense fallback={null}>
          <TradeForm
            journalName={journal.name}
            currency={currency}
            templateFields={templateFields}
            initialTrade={editingTrade}
            initialDate={newTradeDate}
            onSubmit={handleSubmitTrade}
            onClose={handleCloseForm}
            onUploadImage={(file) => onUploadTradeImage(journal.id, file)}
          />
        </Suspense>
      )}

      {view === 'calendar' ? (
        <JournalCalendar
          trades={visibleTrades}
          selectedDate={isFormOpen ? (editingTrade ? toDateKey(editingTrade.date) : newTradeDate) : null}
          onCreateForDate={handleOpenNewTrade}
          onOpenTrade={handleOpenEditTrade}
          headerHint={<CalendarNudge onAddTrade={() => handleOpenNewTrade()} />}
        />
      ) : journal.trades.length === 0 ? (
        <FirstTradeCard
          journalName={journal.name}
          onAddTrade={handleOpenNewTrade}
          onOpenContext={() => setIsContextOpen(true)}
          onCreate={onOpenCreateForm}
        />
      ) : visibleTrades.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-400/60 bg-white/50 p-10 text-center dark:border-white/[0.14] dark:bg-transparent">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">No trades in {describeRangeInline(range)}.</p>
          <button
            type="button"
            onClick={() => setRange(ALL_TIME)}
            className="mt-2 cursor-pointer text-xs font-medium text-sky-800 underline-offset-2 transition hover:underline dark:text-sky-300"
          >
            Clear filter
          </button>
        </div>
      ) : view === 'analysis' ? (
        <Suspense fallback={<AnalysisLoading />}>
          <TradeAnalysis
            trades={visibleTrades}
            currency={currency}
            rangeLabel={isFiltered ? describeRangeInline(range) : null}
          />
        </Suspense>
      ) : tradeLayout === 'table' ? (
        // borderless table: hairline between rows, details panel floats over the rows below
        <TradeTable
          trades={visibleTrades}
          currency={currency}
          detailFields={cardFields}
          fieldIds={cardFieldIds}
          fieldChoices={fieldChoices}
          onFieldsChange={setCardFieldIds}
          onSelect={handleOpenEditTrade}
          onDelete={(tradeId) => onDeleteTrade(journal.id, tradeId)}
          onRetry={onRetryTrade}
          onDiscard={onDiscardTrade}
        />
      ) : (
        // auto-fill grid of chips: as many >=24rem columns as fit. items-start keeps every chip at its own height,
        // because the hover panel floats over the chips below instead of pushing them down
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] items-start gap-2.5">
          {visibleTrades.map((currentTrade) => (
            <TradeCard
              key={currentTrade.id}
              trade={currentTrade}
              currency={currency}
              detailFields={cardFields}
              fieldIds={cardFieldIds}
              fieldChoices={fieldChoices}
              onFieldsChange={setCardFieldIds}
              onSelect={handleOpenEditTrade}
              onDelete={(tradeId) => onDeleteTrade(journal.id, tradeId)}
              onRetry={onRetryTrade}
              onDiscard={onDiscardTrade}
            />
          ))}
        </div>
      )}

      {mentorProgress?.completed && !mentorProgress.celebrated && !isMentorOpen && !isFormOpen && (
        <MentorUnlockBadge
          target={mentorProgress.target}
          onDismiss={celebrateMentor}
          onOpenMentor={() => {
            celebrateMentor()
            openMentor()
          }}
        />
      )}

      {!isMentorOpen && !isFormOpen && (
        <MentorOrb
          onOpen={openMentor}
          onWarm={loadAiMentor}
          progress={mentorProgress}
          hasReadyReview={hasReadyMentorReview}
          onLogTrade={() => handleOpenNewTrade()}
        />
      )}
    </section>
  )
}

export default TradeJournal