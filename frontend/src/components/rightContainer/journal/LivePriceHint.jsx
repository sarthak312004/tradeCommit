const formatPrice = (price) => Number(price).toLocaleString(undefined, { maximumFractionDigits: 8 })

const formatTime = (iso) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const linkButton =
  'rounded-md px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 underline-offset-2 transition-colors hover:bg-zinc-100 hover:text-zinc-950 hover:underline focus-visible:bg-zinc-100 focus-visible:outline-none disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/[0.08] dark:hover:text-zinc-50 dark:focus-visible:bg-white/[0.08]'

/** Small status line under the entry price: what the market is doing right now, and a one-click way to use it. */
export function LivePriceHint({ quote, status, error, filledValue, isFetching, onUse, onRefresh }) {
  if (status === 'idle') return null

  if (status === 'loading') {
    return <p className="mt-0.5 px-2 text-[11px] text-zinc-500 dark:text-zinc-400" aria-live="polite">Fetching live price…</p>
  }

  if (status === 'error') {
    return <p className="mt-0.5 px-2 text-[11px] text-zinc-500 dark:text-zinc-400" aria-live="polite">{error || 'No live price found'}. Enter it manually.</p>
  }

  const isFilled = Number(filledValue) === quote.price
  const open = quote.marketOpen !== false

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2 text-[11px] text-zinc-600 dark:text-zinc-400" aria-live="polite">
      <span className="flex min-w-0 items-center gap-1.5">
        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${open ? 'bg-emerald-500' : 'bg-zinc-400'} ${open && isFetching ? 'animate-pulse' : ''}`} />
        <span className="truncate">
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatPrice(quote.price)}</span>
          {quote.currency ? ` ${quote.currency}` : ''}
          {quote.exchange ? ` · ${quote.exchange}` : ''}
          {open ? '' : ' · market closed, last price'}
          {open && quote.time ? ` · ${formatTime(quote.time)}` : ''}
        </span>
      </span>
      {isFilled ? (
        <span className="text-emerald-700 dark:text-emerald-400">Filled</span>
      ) : (
        <button type="button" onClick={onUse} className={linkButton}>Use</button>
      )}
      <button type="button" onClick={onRefresh} disabled={isFetching} aria-label="Refresh live price" title="Refresh live price" className={linkButton}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={isFetching ? 'animate-spin' : ''}>
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 4v5h-5" />
        </svg>
      </button>
    </div>
  )
}

/** Under the exit price: close the trade at the current market price in one click. Never fills by itself. */
export function ExitQuickFill({ quote, onUse }) {
  if (!quote) return null
  return (
    <div className="mt-0.5 px-2">
      <button type="button" onClick={onUse} className={linkButton}>Use live price {formatPrice(quote.price)}</button>
    </div>
  )
}
