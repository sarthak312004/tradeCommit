import { formatMoney, formatPercent, toneOf } from '../../../utils/tradeAnalytics'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MAX_MONTHS = 12

const barClass = {
  positive: 'bg-emerald-500/70 dark:bg-emerald-400/60',
  negative: 'bg-rose-500/70 dark:bg-rose-400/60',
  neutral: 'bg-zinc-300 dark:bg-white/20'
}

const textClass = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-rose-500 dark:text-rose-400',
  neutral: 'text-zinc-900 dark:text-zinc-100'
}

const monthLabel = (key) => {
  const [year, month] = key.split('-').map(Number)
  return `${MONTHS[month - 1]} ${year}`
}

/** Quiet month-by-month P&L list: label, proportional bar, amount and trade count. */
function MonthlyPnl({ months, currency }) {
  if (!months.length) return null
  const shown = months.slice(-MAX_MONTHS).reverse() // newest first
  const largest = Math.max(...shown.map((month) => Math.abs(month.pnl)), 0)

  return (
    <div>
      <h3 className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        Monthly P&amp;L
        {months.length > MAX_MONTHS && <span className="ml-2 font-normal text-zinc-600 dark:text-zinc-400">last {MAX_MONTHS} months</span>}
      </h3>
      <ul className="divide-y divide-zinc-300 dark:divide-white/[0.09]">
        {shown.map((month) => {
          const tone = toneOf(month.pnl)
          const width = largest > 0 ? Math.max(2, Math.round((Math.abs(month.pnl) / largest) * 100)) : 0
          return (
            <li key={month.month} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-4 py-2.5 text-sm">
              <span className="text-zinc-600 dark:text-zinc-300">{monthLabel(month.month)}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/[0.06]" aria-hidden="true">
                <span className={`block h-full rounded-full ${barClass[tone]}`} style={{ width: `${width}%` }} />
              </span>
              <span className="flex items-baseline gap-3 text-right">
                <span className="hidden text-xs text-zinc-600 sm:inline dark:text-zinc-400">
                  {month.trades} {month.trades === 1 ? 'trade' : 'trades'}, {formatPercent(month.winRate)} win
                </span>
                <span className={`min-w-[5.5rem] font-medium tabular-nums ${textClass[tone]}`}>
                  {formatMoney(month.pnl, { signed: true, currency })}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default MonthlyPnl
