function TradeCard({ trade }) {
  return (
    <article
      className="rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
            {trade.symbol.slice(0, 2)}
          </div>
          <div>
            <p className="text-lg font-semibold tracking-[-0.04em]">{trade.symbol}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{trade.side}</p>
          </div>
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            trade.pnl.startsWith('-')
              ? 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300'
              : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
          }`}
        >
          {trade.pnl}
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>{trade.status}</span>
        <span>{trade.date}</span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">Qty</p>
          <p className="mt-1 text-sm font-medium">{trade.qty}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">Risk</p>
          <p className="mt-1 text-sm font-medium">0.5%</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">Setup</p>
          <p className="mt-1 text-sm font-medium">Breakout</p>
        </div>
      </div>
    </article>
  )
}

export default TradeCard
