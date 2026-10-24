import { useEffect, useId, useRef, useState } from 'react'
import { segmentedGroup, segmentedItem } from '../../../common/controlStyles'
import ImportTradeRow from './ImportTradeRow'
import ImportJournalSelect from './ImportJournalSelect'
import { checkboxClass, rowGrid, textLink } from './importStyles'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'intraday', label: 'Intraday' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'unknown', label: 'Unclassified' }
]

const FORMAT_TEXT = {
  executions: 'Broker tradebook: buys and sells were matched into trades',
  trades: 'One row per trade'
}
const PAGE_SIZE = 100

/**
 * Step 2: review trades, select the ones to import, and choose their destination journal.
 */
function ImportReview({
  preview, trades, kinds, selected, filter, counts, visible, journals, defaultJournal,
  onFilter, onToggle, onToggleVisible, onCycleKind, onDefaultJournal, onChangeFile, onChangeMapping
}) {
  const allRef = useRef(null)
  const switchId = useId()
  const [page, setPage] = useState(0)
  const visibleSelected = visible.filter((trade) => selected.has(trade.id)).length
  const allVisibleChecked = visible.length > 0 && visibleSelected === visible.length
  const pageCount = Math.ceil(visible.length / PAGE_SIZE)
  const currentPage = Math.min(page, Math.max(0, pageCount - 1))
  const pageStart = currentPage * PAGE_SIZE
  const pageTrades = visible.slice(pageStart, pageStart + PAGE_SIZE)
  const rowStart = visible.length === 0 ? 0 : pageStart + 1
  const rowEnd = Math.min(pageStart + PAGE_SIZE, visible.length)

  // tri-state "select all": a dash while only some of the filtered trades are ticked
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = visibleSelected > 0 && visibleSelected < visible.length
  }, [visibleSelected, visible.length])

  const filters = FILTERS.filter((item) => item.id !== 'unknown' || counts.unknown > 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="min-w-0 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-800 dark:text-zinc-100">{trades.length} {trades.length === 1 ? 'trade' : 'trades'}</span>
          {' · '}{FORMAT_TEXT[preview.format]}
          {' · '}
          <button type="button" onClick={onChangeFile} className={textLink}>Choose another file</button>
          {onChangeMapping && (
            <>
              {' · '}
              <button type="button" onClick={onChangeMapping} className={textLink}>Adjust columns</button>
            </>
          )}
        </p>
        <div role="tablist" aria-label="Filter by trade type" className={segmentedGroup}>
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => {
                setPage(0)
                onFilter(item.id)
              }}
              className={segmentedItem(filter === item.id)}
            >
              {item.label}
              <span className="tabular-nums opacity-70">{counts[item.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <section aria-labelledby={switchId} className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3.5 dark:border-white/[0.10] dark:bg-white/[0.03]">
        <div>
          <h3 id={switchId} className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Import selected trades into</h3>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">Choose one journal for this import.</p>
        </div>

        <label className="mt-2 flex w-full max-w-sm flex-col gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
          Destination journal
          <ImportJournalSelect
            journals={journals}
            value={defaultJournal}
            onChange={onDefaultJournal}
            ariaLabel="Import selected trades into"
            className="w-full"
          />
        </label>
      </section>

      {preview.warnings.map((warning) => (
        <p key={warning} className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 dark:bg-amber-300" />
          {warning}
        </p>
      ))}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-300 dark:border-white/[0.14]">
        <div
          style={{ '--cols': rowGrid }}
          className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-600 md:grid-cols-[var(--cols)] dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-zinc-400"
        >
          <input
            ref={allRef}
            type="checkbox"
            checked={allVisibleChecked}
            disabled={visible.length === 0}
            onChange={(event) => onToggleVisible(event.target.checked)}
            aria-label={`Select all ${visible.length} filtered trades`}
            className={checkboxClass}
          />
          <span className="normal-case tracking-normal md:hidden">{visibleSelected} of {visible.length} filtered selected</span>
          <span className="hidden md:block">Trade</span>
          <span className="hidden md:block">Size &amp; prices</span>
          <span className="hidden text-right md:block">P&amp;L</span>
          <span className="hidden md:block">Type</span>
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-zinc-600 dark:text-zinc-400">No trades with this tag.</p>
        ) : (
          <ul className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {pageTrades.map((trade) => (
              <ImportTradeRow
                key={trade.id}
                trade={trade}
                kind={kinds[trade.id] ?? trade.kind}
                checked={selected.has(trade.id)}
                onToggle={onToggle}
                onCycleKind={onCycleKind}
              />
            ))}
          </ul>
        )}
        {visible.length > PAGE_SIZE && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-600 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-zinc-400">
            <span>Rows {rowStart}–{rowEnd} of {visible.length}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                disabled={currentPage === 0}
                className="rounded-md px-2 py-1 font-medium hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/[0.08]"
              >
                Previous
              </button>
              <span aria-live="polite">{currentPage + 1} / {pageCount}</span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                disabled={currentPage >= pageCount - 1}
                className="rounded-md px-2 py-1 font-medium hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/[0.08]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {preview.skippedCount > 0 && (
        <details className="text-xs text-zinc-600 dark:text-zinc-400">
          <summary className="cursor-pointer select-none font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50">
            {preview.skippedCount} {preview.skippedCount === 1 ? 'row was' : 'rows were'} skipped
          </summary>
          <ul className="subtle-scrollbar mt-2 max-h-24 space-y-0.5 overflow-y-auto">
            {preview.skipped.map((item) => (
              <li key={`${item.row}-${item.reason}`}>Row {item.row}{item.symbol ? ` (${item.symbol})` : ''}: {item.reason}</li>
            ))}
            {preview.skippedCount > preview.skipped.length && <li>and {preview.skippedCount - preview.skipped.length} more</li>}
          </ul>
        </details>
      )}
    </div>
  )
}

export default ImportReview
