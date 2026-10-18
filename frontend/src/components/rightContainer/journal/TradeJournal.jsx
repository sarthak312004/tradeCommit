import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import JournalCalendar from './JournalCalendar'
import TradeCard from './TradeCard'
import DateRangeFilter from './DateRangeFilter'
import JournalActionsMenu from './JournalActionsMenu'
import MentorOrb from './MentorOrb'
import { ALL_TIME, describeRangeInline, isRangeActive } from '../../../utils/dateRange'
import { filterTradesByDate, sortTradesNewestFirst, toDateKey } from '../../../utils/tradeAnalytics'
import { DEFAULT_CURRENCY } from '../../../utils/currencies'
import { buildTemplateFields, hasJournalContext } from '../../../utils/customFields'
import { buildFieldChoices, collectCustomFieldOptions, resolveCardFields } from '../../../utils/tradeCardFields'
import { useTradeCardFields } from '../../../hooks/useTradeCardFields'
import { SlidersIcon } from '../../../utils/Icons.jsx'

// loaded on demand so the first paint ships less JavaScript
const loadTradeForm = () => import('./TradeForm')
const TradeForm = lazy(loadTradeForm)
const TradeAnalysis = lazy(() => import('./TradeAnalysis'))
const JournalContextDialog = lazy(() => import('./JournalContextDialog'))
const ExportJournalDialog = lazy(() => import('./ExportJournalDialog'))
// the mentor is reachable from every tab, so its code is warmed up when the orb is hovered or focused
const loadAiMentor = () => import('./AiMentorDialog')
const AiMentorDialog = lazy(loadAiMentor)

const VIEWS = [
  { id: 'trades', label: 'Trades', path: '/' },
  { id: 'calendar', label: 'Calendar', path: '/calendar' },
  { id: 'analysis', label: 'Analysis', path: '/analysis' }
]

function TradeJournal({ view = 'trades', journal, onAddTrade, onUpdateTrade, onDeleteTrade, onUploadTradeImage, onSaveContext, onRetryTrade, onDiscardTrade }) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTrade, setEditingTrade] = useState(null)
  const navigate = useNavigate()
  // date picked on the calendar for a new trade (null = form opens on today)
  const [newTradeDate, setNewTradeDate] = useState(null)
  const [range, setRange] = useState(ALL_TIME)
  const [isContextOpen, setIsContextOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isMentorOpen, setIsMentorOpen] = useState(false)

  // fetch the form's code while the browser is idle so the drawer opens instantly on the first click
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((callback) => setTimeout(callback, 1500))
    const cancel = window.cancelIdleCallback ?? clearTimeout
    const handle = idle(loadTradeForm)
    return () => cancel(handle)
  }, [])

  const allTrades = journal?.trades
  // newest first, so a trade you just logged is the first card
  const visibleTrades = useMemo(() => sortTradesNewestFirst(filterTradesByDate(allTrades ?? [], range)), [allTrades, range])

  // new trades start with the journal's default properties, plus any extras from the most recent trade
  const journalContext = journal?.context
  const templateFields = useMemo(() => buildTemplateFields(journalContext, allTrades ?? []), [journalContext, allTrades])

  // the details (max 3) a trade chip shows when hovered: edited with the pencil on the chip, remembered in this browser
  const [cardFieldIds, setCardFieldIds] = useTradeCardFields()
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
  const handleSubmitTrade = (trade, options) => (
    editingTrade
      ? onUpdateTrade(journal.id, editingTrade.id, trade, options)
      : onAddTrade(journal.id, trade, options)
  )

  if (!journal) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-400/60 bg-white/50 p-10 text-center dark:border-white/[0.14] dark:bg-transparent">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Create or select a journal to view trades.</p>
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
            data-tour="add-trade"
            className="h-8 cursor-pointer rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white transition hover:bg-sky-600"
          >
            + Add trade
          </button>

          <JournalActionsMenu onExport={() => setIsExportOpen(true)} />
        </div>
      </div>

      {isContextOpen && (
        <Suspense fallback={null}>
          <JournalContextDialog
            journalId={journal.id}
            journalName={journal.name}
            context={journalContext}
            onSave={(context, options) => onSaveContext(journal.id, context, options)}
            onClose={() => setIsContextOpen(false)}
          />
        </Suspense>
      )}

      {isMentorOpen && (
        <Suspense fallback={null}>
          <AiMentorDialog
            journalId={journal.id}
            journalName={journal.name}
            currency={currency}
            initialRange={isFiltered ? range : null}
            onClose={() => setIsMentorOpen(false)}
            onOpenContext={() => {
              setIsMentorOpen(false)
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
        // always shown, even with no trades, so any day can be clicked to log one
        <JournalCalendar
          trades={visibleTrades}
          selectedDate={isFormOpen ? (editingTrade ? toDateKey(editingTrade.date) : newTradeDate) : null}
          onCreateForDate={handleOpenNewTrade}
          onOpenTrade={handleOpenEditTrade}
        />
      ) : journal.trades.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-400/60 bg-white/50 p-10 text-center dark:border-white/[0.14] dark:bg-transparent">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">No trades in this journal yet.</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Add your first trade to start tracking this journal.</p>
        </div>
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
        <Suspense fallback={null}>
          <TradeAnalysis
            trades={visibleTrades}
            currency={currency}
            rangeLabel={isFiltered ? describeRangeInline(range) : null}
          />
        </Suspense>
      ) : (
        // auto-fill grid of chips: as many >=24rem columns as fit. items-start keeps every chip at its own height,
        // because the hover panel floats over the chips below instead of pushing them down
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] items-start gap-3">
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

      {!isMentorOpen && <MentorOrb onOpen={() => setIsMentorOpen(true)} onWarm={loadAiMentor} />}
    </section>
  )
}

export default TradeJournal