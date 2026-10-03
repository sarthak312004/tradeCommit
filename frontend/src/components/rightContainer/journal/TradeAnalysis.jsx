import { useMemo } from 'react'
import EquityCurve from './EquityCurve'
import { computeAnalytics, formatMoney, formatPercent, formatR, formatRatio, toneOf } from '../../../utils/tradeAnalytics'

const toneClass = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-rose-500 dark:text-rose-400',
  neutral: 'text-zinc-900 dark:text-zinc-100'
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

function Stat({ label, value, hint, tone = 'neutral' }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tracking-tight tabular-nums ${toneClass[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">{hint}</p>}
    </div>
  )
}

function MetricList({ title, rows }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{title}</h3>
      <dl className="divide-y divide-zinc-200/80 dark:divide-white/[0.06]">
        {rows.map(({ label, value, note, tone = 'neutral' }) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
            <dt className="text-zinc-600 dark:text-zinc-300">
              {label}
              {note && <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">{note}</span>}
            </dt>
            <dd className={`font-medium tabular-nums ${toneClass[tone]}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function TradeAnalysis({ trades, rangeLabel }) {
  const stats = useMemo(() => computeAnalytics(trades), [trades])
  const hasClosed = stats.closedTrades > 0

  const sideNote = (side) => (side.count ? `${plural(side.count, 'trade')}, ${formatPercent(side.winRate)} win` : 'no trades')

  const performanceRows = [
    { label: 'Average win', value: formatMoney(stats.avgWin), tone: stats.avgWin ? 'positive' : 'neutral' },
    { label: 'Average loss', value: formatMoney(stats.avgLoss === null ? null : -stats.avgLoss), tone: stats.avgLoss ? 'negative' : 'neutral' },
    { label: 'Payoff ratio', value: formatRatio(stats.payoffRatio), note: 'avg win / avg loss' },
    { label: 'Best trade', value: formatMoney(stats.bestTrade, { signed: true }), tone: toneOf(stats.bestTrade) },
    { label: 'Worst trade', value: formatMoney(stats.worstTrade, { signed: true }), tone: toneOf(stats.worstTrade) }
  ]

  const consistencyRows = [
    { label: 'Max drawdown', value: hasClosed ? formatMoney(-stats.maxDrawdown) : '-', tone: stats.maxDrawdown > 0 ? 'negative' : 'neutral' },
    { label: 'Longest win streak', value: hasClosed ? String(stats.winStreak) : '-' },
    { label: 'Longest losing streak', value: hasClosed ? String(stats.lossStreak) : '-' },
    { label: 'Long', value: formatMoney(stats.long.count ? stats.long.netPnl : null, { signed: true }), note: sideNote(stats.long), tone: stats.long.count ? toneOf(stats.long.netPnl) : 'neutral' },
    { label: 'Short', value: formatMoney(stats.short.count ? stats.short.netPnl : null, { signed: true }), note: sideNote(stats.short), tone: stats.short.count ? toneOf(stats.short.netPnl) : 'neutral' }
  ]

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/80 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="p-5 pb-3 sm:p-6 sm:pb-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Net P&amp;L</p>
        <p className={`mt-1 text-3xl font-semibold tracking-tight tabular-nums ${toneClass[toneOf(stats.netPnl)]}`}>
          {formatMoney(stats.netPnl, { signed: true })}
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{plural(stats.closedTrades, 'closed trade')}{rangeLabel ? ` in ${rangeLabel}` : ''}</p>
      </div>

      <div className="px-3 pb-4 sm:px-4">
        {hasClosed ? (
          <EquityCurve points={stats.equity} />
        ) : (
          <div className="grid h-52 place-items-center px-6 text-center">
            <div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">No closed trades to chart</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Add an exit price to a trade and its result shows up here.</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-zinc-200 p-5 sm:p-6 md:grid-cols-5 dark:border-zinc-800">
        <Stat label="Total trades" value={String(stats.totalTrades)} hint={`${stats.closedTrades} closed, ${stats.openTrades} open`} />
        <Stat label="Win rate" value={formatPercent(stats.winRate)} hint={hasClosed ? `${stats.wins} won, ${stats.losses} lost` : undefined} />
        <Stat label="Profit factor" value={formatRatio(stats.profitFactor)} hint="gross profit / gross loss" />
        <Stat label="Expectancy" value={formatMoney(stats.expectancy, { signed: true })} tone={toneOf(stats.expectancy)} hint="average per closed trade" />
        <Stat
          label="Avg RRR"
          value={formatR(stats.avgRrr)}
          tone={stats.avgRrr === null ? 'neutral' : toneOf(stats.avgRrr)}
          hint={stats.rrrSample ? `${stats.rrrSample} of ${stats.closedTrades} trades have a stop loss` : 'add a stop loss to your trades'}
        />
      </div>

      <div className="grid gap-x-12 gap-y-6 border-t border-zinc-200 p-5 sm:p-6 md:grid-cols-2 dark:border-zinc-800">
        <MetricList title="Performance" rows={performanceRows} />
        <MetricList title="Risk and consistency" rows={consistencyRows} />
      </div>
    </div>
  )
}

export default TradeAnalysis
