import { useMemo, useState } from 'react'
import TradeCard from './TradeCard'
import TradeForm from './TradeForm'
import TradeAnalysis from './TradeAnalysis'
import DateRangeFilter from './DateRangeFilter'
import { ALL_TIME, describeRangeInline, isRangeActive } from '../../../utils/dateRange'
import { filterTradesByDate } from '../../../utils/tradeAnalytics'
import { DEFAULT_CURRENCY } from '../../../utils/currencies'

const VIEWS = [
  { id: 'trades', label: 'Trades' },
  { id: 'analysis', label: 'Analysis' }
]

function TradeJournal({ journal, isSidebarOpen, onAddTrade, onUpdateTrade, onDeleteTrade, onUploadTradeImage }) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTrade, setEditingTrade] = useState(null)
  const [view, setView] = useState('trades')
  const [range, setRange] = useState(ALL_TIME)

  const allTrades = journal?.trades
  const visibleTrades = useMemo(() => filterTradesByDate(allTrades ?? [], range), [allTrades, range])

  // new trades start with the custom fields of the most recent trade in this journal
  const templateFields = useMemo(() => {
    const latest = [...(allTrades ?? [])].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0]
    return (latest?.customFields ?? []).map(({ key, label, type }) => ({ key, label, type }))
  }, [allTrades])

  const handleOpenNewTrade = () => {
    setEditingTrade(null)
    setIsFormOpen(true)
  }

  const handleOpenEditTrade = (trade) => {
    setEditingTrade(trade)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setEditingTrade(null)
    setIsFormOpen(false)
  }

  const handleSubmitTrade = (trade) => {
    if (editingTrade) {
      onUpdateTrade(journal.id, editingTrade.id, trade)
    } else {
      onAddTrade(journal.id, {...trade, id: Date.now()})
    }

    handleCloseForm()
  }

  if (!journal) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-white/10">
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
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-[-0.05em]">{view === 'analysis' ? 'Analysis' : 'Recent trades'}</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Journal view" className="inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white/60 p-0.5 dark:border-white/10 dark:bg-transparent">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={view === item.id}
                onClick={() => setView(item.id)}
                className={`h-full cursor-pointer rounded-md px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 ${
                  view === item.id
                    ? 'bg-zinc-900 text-white dark:bg-white/10 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <DateRangeFilter range={range} onChange={setRange} />

          <button
            type="button"
            onClick={isFormOpen ? handleCloseForm : handleOpenNewTrade}
            className="h-8 cursor-pointer rounded-lg bg-sky-500 px-3 text-xs font-semibold text-white transition hover:bg-sky-600"
          >
            + Add trade
          </button>
        </div>
      </div>

      {isFormOpen && (
        <TradeForm
          journalName={journal.name}
          currency={currency}
          templateFields={templateFields}
          initialTrade={editingTrade}
          onSubmit={handleSubmitTrade}
          onClose={handleCloseForm}
          onUploadImage={(file) => onUploadTradeImage(journal.id, file)}
        />
      )}

      {journal.trades.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-white/10">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">No trades in this journal yet.</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Add your first trade to start tracking this journal.</p>
        </div>
      ) : visibleTrades.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-white/10">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">No trades in {describeRangeInline(range)}.</p>
          <button
            type="button"
            onClick={() => setRange(ALL_TIME)}
            className="mt-2 cursor-pointer text-xs font-medium text-sky-600 transition hover:text-sky-500 dark:text-sky-400"
          >
            Clear filter
          </button>
        </div>
      ) : view === 'analysis' ? (
        <TradeAnalysis trades={visibleTrades} currency={currency} rangeLabel={isFiltered ? describeRangeInline(range) : null} />
      ) : (
        <div className={`grid gap-3 sm:grid-cols-2 ${isSidebarOpen ? 'xl:grid-cols-3' : 'lg:grid-cols-3 2xl:grid-cols-4'}`}>
          {visibleTrades.map((currentTrade) => (
            <TradeCard
              key={currentTrade.id}
              trade={currentTrade}
              currency={currency}
              onSelect={handleOpenEditTrade}
              onDelete={(tradeId) => onDeleteTrade(journal.id, tradeId)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default TradeJournal
