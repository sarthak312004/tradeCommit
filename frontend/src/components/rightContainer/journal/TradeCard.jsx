import { useState } from 'react'

function TradeCard({ trade, onSelect, onDelete }) {
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)
  const pnlValue = String(trade.pnl ?? '')
  const pnlState = pnlValue.trim().startsWith('-')
    ? 'negative'
    : Number.parseFloat(pnlValue.replace(/[^0-9.-]/g, '')) === 0
      ? 'neutral'
      : 'positive'
  const pnlStyles = {
    positive: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    negative: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300',
    neutral: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
  }

  const handleCardKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(trade)
    }
  }

  const handleDelete = (event) => {
    event.stopPropagation()
    onDelete(trade.id)
    setIsDeleteConfirmationOpen(false)
  }

  return (
    <article 
      role="button"
      tabIndex="0"
      onClick={() => onSelect(trade)}
      onKeyDown={handleCardKeyDown}
      className="group relative cursor-pointer rounded-2xl border border-zinc-200 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-400/40 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-sky-900"
    >
      <div className="absolute right-3 top-3 flex translate-y-1 items-center gap-1 opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
        {/* <button
          type="button"
          title="Review trade"
          aria-label={`Review ${trade.symbol} trade`}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(trade)
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-200 transition hover:bg-sky-50 hover:text-sky-600 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700 dark:hover:bg-sky-950/50 dark:hover:text-sky-300"
        >
          <span aria-hidden="true">✎</span>
        </button> */}
        <button
          type="button"
          title="Delete trade"
          aria-label={`Delete ${trade.symbol} trade`}
          onClick={(event) => {
            event.stopPropagation()
            setIsDeleteConfirmationOpen(true)
          }}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-200 transition hover:bg-rose-50 hover:text-rose-600 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-300"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
							<path d="M3 6h18" />
							<path d="M8 6V4h8v2" />
							<path d="m19 6-1 14H6L5 6" />
							<path d="M10 10v6M14 10v6" />
						</svg>
        </button>
      </div>

      <div className="flex min-h-12 items-start justify-between gap-3 pr-16">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
            {trade.symbol.slice(0, 2)}
          </div>
          <div>
            <p className="truncate text-lg font-semibold tracking-[-0.04em]">{trade.symbol}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{trade.side}</p>
          </div>
        </div>

        <span data-pnl-state={pnlState} className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${pnlStyles[pnlState]}`}>
          {trade.pnl}
        </span>
      </div>

      <div className="mt-5 flex min-h-5 items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>{trade.status}</span>
        <span>{trade.date}</span>
      </div>

      <div className="mt-5 grid min-h-14 grid-cols-3 gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">Qty</p>
          <p className="mt-1 text-sm font-medium">{trade.qty}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">Entry</p>
          <p className="mt-1 text-sm font-medium">{trade.entry || '-'}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">Exit</p>
          <p className="mt-1 text-sm font-medium">{trade.exit || '-'}</p>
        </div>
      </div>

      <div className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ${isDeleteConfirmationOpen ? 'mt-4 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-900/60 dark:bg-rose-950/30">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300">Delete this trade?</p>
            <div className="flex gap-1.5">
              <button type="button" onClick={(event) => { event.stopPropagation(); setIsDeleteConfirmationOpen(false) }} className="rounded-md px-2 py-1 text-[10px] font-medium text-zinc-500 transition hover:bg-white hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">Cancel</button>
              <button type="button" onClick={handleDelete} className="rounded-md bg-rose-500 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-rose-600">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

export default TradeCard