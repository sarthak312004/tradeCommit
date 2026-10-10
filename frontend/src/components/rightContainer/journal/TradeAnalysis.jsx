import { Suspense, lazy, useMemo, useState } from 'react'
import EquityCurve from './EquityCurve'
import SparklesIcon from './SparklesIcon'
import { controlNeutral } from '../../common/controlStyles'
import { computeAnalytics, formatMoney, formatPercent, formatR, formatRatio, toneOf } from '../../../utils/tradeAnalytics'

// loaded only when the mentor is opened
const AiMentorDialog = lazy(() => import('./AiMentorDialog'))

const toneClass = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-rose-500 dark:text-rose-400',
  neutral: 'text-zinc-900 dark:text-zinc-100'
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

function Stat({ label, value, hint, tone = 'neutral' }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-zinc-600 dark:text-zinc-300">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tracking-tight tabular-nums ${toneClass[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">{hint}</p>}
    </div>
  )
}

function MetricList({ title, rows }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">{title}</h3>
      <dl className="divide-y divide-zinc-300 dark:divide-white/[0.09]">
        {rows.map(({ label, value, note, tone = 'neutral' }) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
            <dt className="text-zinc-600 dark:text-zinc-300">
              {label}
              {note && <span className="ml-2 text-xs text-zinc-600 dark:text-zinc-400">{note}</span>}
            </dt>
            <dd className={`font-medium tabular-nums ${toneClass[tone]}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function TradeAnalysis({ trades, currency, rangeLabel, journalId, journalName, onOpenContext }) {
  const [isMentorOpen, setIsMentorOpen] = useState(false)
  const money = (value, options) => formatMoney(value, { currency, ...options })
  const stats = useMemo(() => computeAnalytics(trades), [trades])
  const hasClosed = stats.closedTrades > 0

  const sideNote = (side) => (side.count ? `${plural(side.count, 'trade')}, ${formatPercent(side.winRate)} win` : 'no trades')

  const performanceRows = [
    { label: 'Average win', value: money(stats.avgWin), tone: stats.avgWin ? 'positive' : 'neutral' },
    { label: 'Average loss', value: money(stats.avgLoss === null ? null : -stats.avgLoss), tone: stats.avgLoss ? 'negative' : 'neutral' },
    { label: 'Payoff ratio', value: formatRatio(stats.payoffRatio), note: 'avg win / avg loss' },
    { label: 'Best trade', value: money(stats.bestTrade, { signed: true }), tone: toneOf(stats.bestTrade) },
    { label: 'Worst trade', value: money(stats.worstTrade, { signed: true }), tone: toneOf(stats.worstTrade) }
  ]

  const consistencyRows = [
    { label: 'Max drawdown', value: hasClosed ? money(-stats.maxDrawdown) : '-', tone: stats.maxDrawdown > 0 ? 'negative' : 'neutral' },
    { label: 'Longest win streak', value: hasClosed ? String(stats.winStreak) : '-' },
    { label: 'Longest losing streak', value: hasClosed ? String(stats.lossStreak) : '-' },
    { label: 'Long', value: money(stats.long.count ? stats.long.netPnl : null, { signed: true }), note: sideNote(stats.long), tone: stats.long.count ? toneOf(stats.long.netPnl) : 'neutral' },
    { label: 'Short', value: money(stats.short.count ? stats.short.netPnl : null, { signed: true }), note: sideNote(stats.short), tone: stats.short.count ? toneOf(stats.short.netPnl) : 'neutral' }
  ]

  return (
    <div className="rounded-2xl border border-zinc-300 bg-white shadow-card dark:border-white/[0.12] dark:bg-panel dark:shadow-none">
      <div className="flex items-start justify-between gap-4 p-5 pb-3 sm:p-6 sm:pb-4">
        <div className="min-w-0">
          <p className="text-xs text-zinc-600 dark:text-zinc-300">Net P&amp;L</p>
          <p className={`mt-1 text-3xl font-semibold tracking-tight tabular-nums ${toneClass[toneOf(stats.netPnl)]}`}>
            {money(stats.netPnl, { signed: true })}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{plural(stats.closedTrades, 'closed trade')}{rangeLabel ? ` in ${rangeLabel}` : ''}</p>
        </div>

        {journalId && (
          <button type="button" onClick={() => setIsMentorOpen(true)} title="Weekly feedback from an AI mentor, checked against your strategy" className={controlNeutral}>
            <SparklesIcon className="h-3.5 w-3.5" />
            Mentor review
          </button>
        )}
      </div>

      <div className="px-3 pb-4 sm:px-4">
        {hasClosed ? (
          <EquityCurve points={stats.equity} currency={currency} />
        ) : (
          <div className="grid h-52 place-items-center px-6 text-center">
            <div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">No closed trades to chart</p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Add an exit price to a trade and its result shows up here.</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-zinc-300 p-5 sm:p-6 md:grid-cols-5 dark:border-white/[0.12]">
        <Stat label="Total trades" value={String(stats.totalTrades)} hint={`${stats.closedTrades} closed, ${stats.openTrades} open`} />
        <Stat label="Win rate" value={formatPercent(stats.winRate)} hint={hasClosed ? `${stats.wins} won, ${stats.losses} lost` : undefined} />
        <Stat label="Profit factor" value={formatRatio(stats.profitFactor)} hint="gross profit / gross loss" />
        <Stat label="Expectancy" value={money(stats.expectancy, { signed: true })} tone={toneOf(stats.expectancy)} hint="average per closed trade" />
        <Stat
          label="Avg RRR"
          value={formatR(stats.avgRrr)}
          tone={stats.avgRrr === null ? 'neutral' : toneOf(stats.avgRrr)}
          hint={stats.rrrSample ? `${stats.rrrSample} of ${stats.closedTrades} trades have a stop loss` : 'add a stop loss to your trades'}
        />
      </div>

      <div className="grid gap-x-12 gap-y-6 border-t border-zinc-300 p-5 sm:p-6 md:grid-cols-2 dark:border-white/[0.12]">
        <MetricList title="Performance" rows={performanceRows} />
        <MetricList title="Risk and consistency" rows={consistencyRows} />
      </div>

      {isMentorOpen && (
        <Suspense fallback={null}>
          <AiMentorDialog
            journalId={journalId}
            journalName={journalName}
            currency={currency}
            onClose={() => setIsMentorOpen(false)}
            onOpenContext={
              onOpenContext &&
              (() => {
                setIsMentorOpen(false)
                onOpenContext()
              })
            }
          />
        </Suspense>
      )}
    </div>
  )
}

export default TradeAnalysis
