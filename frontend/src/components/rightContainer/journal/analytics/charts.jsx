import { formatMoney, formatPercent, toneOf } from '../../../../utils/tradeAnalytics'
import { toneText } from './parts'

const barTone = {
  positive: 'bg-emerald-500/70 dark:bg-emerald-400/60',
  negative: 'bg-rose-500/70 dark:bg-rose-400/60',
  neutral: 'bg-zinc-300 dark:bg-white/20'
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/**
 * Horizontal bar rows for any grouped breakdown (weekday, hour, instrument, strategy...).
 * Bar length is relative to the largest absolute P&L in the list; groups with a very small
 * sample are faded and say so.
 */
export function BreakdownRows({ rows, currency }) {
  const largest = Math.max(...rows.map((row) => Math.abs(row.netPnl)), 0)
  return (
    <ul className="divide-y divide-zinc-300 dark:divide-white/[0.09]">
      {rows.map((row) => {
        const empty = row.count === 0
        const tone = empty ? 'neutral' : toneOf(row.netPnl)
        const width = largest > 0 && !empty ? Math.max(2, Math.round((Math.abs(row.netPnl) / largest) * 100)) : 0
        return (
          <li
            key={row.key}
            className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4 py-2.5 text-sm ${row.lowSample ? 'opacity-70' : ''}`}
          >
            <div className="min-w-0">
              <p className="truncate text-zinc-700 dark:text-zinc-200" title={row.label}>{row.label}</p>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                {empty ? 'no trades' : `${plural(row.count, 'trade')}, ${formatPercent(row.winRate)} win${row.lowSample ? ', low sample' : ''}`}
              </p>
            </div>
            <span className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/[0.06]" aria-hidden="true">
              <span className={`block h-full rounded-full ${barTone[tone]}`} style={{ width: `${width}%` }} />
            </span>
            <span className={`min-w-[5.5rem] text-right font-medium tabular-nums ${toneText[tone]}`}>
              {empty ? '-' : formatMoney(row.netPnl, { signed: true, currency })}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Year x month grid of net P&L. Colour strength is relative to the biggest month shown. */
export function Heatmap({ grid, currency }) {
  const largest = Math.max(...grid.flatMap((row) => row.months.map((cell) => (cell ? Math.abs(cell.pnl) : 0))), 0)
  const shade = (pnl) => {
    if (pnl === 0 || largest === 0) return undefined
    const alpha = 0.12 + 0.43 * (Math.abs(pnl) / largest)
    return { backgroundColor: pnl > 0 ? `rgba(16, 185, 129, ${alpha.toFixed(2)})` : `rgba(244, 63, 94, ${alpha.toFixed(2)})` }
  }
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[36rem] border-separate border-spacing-1 text-center text-[11px]">
        <thead>
          <tr className="text-zinc-600 dark:text-zinc-400">
            <th scope="col" className="w-10 text-left font-normal"><span className="sr-only">Year</span></th>
            {MONTH_NAMES.map((name) => <th key={name} scope="col" className="font-normal">{name}</th>)}
            <th scope="col" className="pl-2 text-right font-normal">Year</th>
          </tr>
        </thead>
        <tbody>
          {grid.map((row) => (
            <tr key={row.year}>
              <th scope="row" className="text-left font-normal text-zinc-600 dark:text-zinc-300">{row.year}</th>
              {row.months.map((cell, index) => (
                <td
                  key={MONTH_NAMES[index]}
                  style={cell ? shade(cell.pnl) : undefined}
                  title={cell ? `${MONTH_NAMES[index]} ${row.year}: ${formatMoney(cell.pnl, { signed: true, currency })}, ${plural(cell.trades, 'trade')}` : `${MONTH_NAMES[index]} ${row.year}: no closed trades`}
                  className={`rounded-md py-2 tabular-nums ${cell ? 'bg-zinc-100 text-zinc-800 dark:bg-white/[0.06] dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-600'}`}
                >
                  {cell ? formatMoney(cell.pnl, { compact: true, currency }) : ''}
                </td>
              ))}
              <td className={`pl-2 text-right font-medium tabular-nums ${toneText[toneOf(row.total)]}`}>
                {formatMoney(row.total, { signed: true, compact: true, currency })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Vertical-bar histogram. `labelOf(bin)` is the short tick under each bar; every bar also has a tooltip. */
export function Histogram({ bins, labelOf, titleOf, ariaLabel }) {
  const most = Math.max(...bins.map((bin) => bin.count), 1)
  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="flex h-36 items-end gap-1">
        {bins.map((bin, index) => (
          <div key={index} title={titleOf(bin)} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <span className="h-4 text-center text-[10px] leading-4 tabular-nums text-zinc-600 dark:text-zinc-400">{bin.count || ''}</span>
            <div
              className={`w-full rounded-t ${bin.side === 'loss' ? 'bg-rose-500/70 dark:bg-rose-400/60' : 'bg-emerald-500/70 dark:bg-emerald-400/60'}`}
              style={{ height: `calc((100% - 1rem) * ${bin.count / most})`, minHeight: bin.count ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 border-t border-zinc-300 pt-1 dark:border-white/[0.12]">
        {bins.map((bin, index) => (
          <span key={index} className="min-w-0 flex-1 truncate text-center text-[10px] tabular-nums text-zinc-600 dark:text-zinc-400">{labelOf(bin)}</span>
        ))}
      </div>
    </div>
  )
}

/** Underwater chart: distance below the running equity peak after each closed trade (0 at the top). */
export function DrawdownChart({ points, currency }) {
  const worst = Math.max(...points.map((point) => point.drawdown ?? 0), 0)
  const last = Math.max(points.length - 1, 1)
  const x = (index) => (index / last) * 100
  const y = (value) => (worst > 0 ? (value / worst) * 100 : 0)
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(point.drawdown ?? 0).toFixed(2)}`).join(' ')
  const area = `${line} L100,0 L0,0 Z`
  const current = points.length ? points[points.length - 1].drawdown ?? 0 : 0
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 px-1 text-[11px] text-zinc-600 dark:text-zinc-400">
        <span>Drawdown from equity peak</span>
        <span className="tabular-nums">
          worst {formatMoney(-worst, { currency })}, now {formatMoney(-current, { currency })}
        </span>
      </div>
      {worst > 0 ? (
        <div role="img" aria-label={`Drawdown chart. Worst drawdown ${formatMoney(-worst, { currency })}, currently ${formatMoney(-current, { currency })}.`} className="relative h-24 rounded-lg bg-zinc-50 dark:bg-white/[0.03]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <path d={area} className="fill-rose-500/15 dark:fill-rose-400/15" />
            <path d={line} fill="none" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="stroke-rose-500 dark:stroke-rose-400" />
          </svg>
          <span className="absolute left-2 top-1 text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">0</span>
          <span className="absolute bottom-1 left-2 text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">{formatMoney(-worst, { compact: true, currency })}</span>
        </div>
      ) : (
        <div className="grid h-16 place-items-center rounded-lg bg-zinc-50 text-xs text-zinc-600 dark:bg-white/[0.03] dark:text-zinc-400">
          No drawdown yet: equity has not fallen below a previous high.
        </div>
      )}
    </div>
  )
}
