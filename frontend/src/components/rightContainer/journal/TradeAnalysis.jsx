import { useMemo } from 'react'
import EquityCurve from './EquityCurve'
import MonthlyPnl from './MonthlyPnl'
import { computeAnalytics, formatMoney, formatPercent, formatR, formatRatio, toneOf } from '../../../utils/tradeAnalytics'
import { MIN_RELIABLE_SAMPLE } from '../../../utils/tradeMetrics'
import { canViewMetric } from '../../../config/analyticsAccess'

const toneClass = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-rose-500 dark:text-rose-400',
  neutral: 'text-zinc-900 dark:text-zinc-100'
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

const CONSISTENCY_LABEL = { consistent: 'Consistent', moderate: 'Moderate', varied: 'Varied' }
const CONSISTENCY_TONE = { consistent: 'positive', moderate: 'neutral', varied: 'negative' }

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
  if (!rows.length) return null
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

// each entry carries the metric id the access config knows it by, so restricting one later is a config change
const visible = (entries) => entries.filter((entry) => canViewMetric(entry.metric))

function TradeAnalysis({ trades, currency, rangeLabel, mode }) {
  const money = (value, options) => formatMoney(value, { currency, ...options })
  // a trade that failed to save (shown with Retry / Discard) isn't in the journal yet, so it stays out of the numbers
  const stats = useMemo(() => computeAnalytics(trades.filter((trade) => trade.syncState !== 'failed')), [trades])
  const hasClosed = stats.closedTrades > 0
  // reward-to-risk in R when stops are logged, otherwise the same idea by amount
  const rewardRisk = stats.rewardRisk ?? stats.payoffRatio
  const risk = stats.riskConsistency
  const lowSample = hasClosed && !stats.sample.reliable
  const modeLabel = mode === 'backtest' ? 'Backtest journal' : mode === 'live' ? 'Live journal' : null
  const rSampleHint = stats.rSample > 0 && stats.rSample < stats.closedTrades ? `from ${stats.rSample} of ${stats.closedTrades} trades with a stop loss` : null

  const sideNote = (side) => (side.count ? `${plural(side.count, 'trade')}, ${formatPercent(side.winRate)} win` : 'no trades')

  const performanceRows = visible([
    { metric: 'avgWinLoss', label: 'Average win', value: money(stats.avgWin), tone: stats.avgWin ? 'positive' : 'neutral' },
    { metric: 'avgWinLoss', label: 'Average loss', value: money(stats.avgLoss === null ? null : -stats.avgLoss), tone: stats.avgLoss ? 'negative' : 'neutral' },
    { metric: 'avgRiskReward', label: 'Payoff ratio', value: formatRatio(stats.payoffRatio), note: 'avg win / avg loss, by amount' },
    { metric: 'avgR', label: 'Average R', value: formatR(stats.avgR), note: rSampleHint ?? 'per trade with a stop loss', tone: stats.avgR === null ? 'neutral' : toneOf(stats.avgR) },
    { metric: 'bestWorstTrade', label: 'Best trade', value: money(stats.bestTrade, { signed: true }), tone: toneOf(stats.bestTrade) },
    { metric: 'bestWorstTrade', label: 'Worst trade', value: money(stats.worstTrade, { signed: true }), tone: toneOf(stats.worstTrade) },
    { metric: 'winsLosses', label: 'Winners / losers', value: hasClosed ? `${stats.wins} / ${stats.losses}` : '-', note: stats.breakevenTrades ? `${stats.breakevenTrades} breakeven` : null }
  ])

  const riskRows = visible([
    { metric: 'maxDrawdown', label: 'Max drawdown', value: hasClosed ? money(-stats.maxDrawdown) : '-', note: 'peak to trough', tone: stats.maxDrawdown > 0 ? 'negative' : 'neutral' },
    {
      metric: 'recoveryFactor',
      label: 'Recovery factor',
      value: formatRatio(stats.recoveryFactor),
      note: stats.recoveryFactor === null && hasClosed ? 'no drawdown yet' : 'net P&L / max drawdown',
      tone: stats.recoveryFactor === null ? 'neutral' : toneOf(stats.recoveryFactor)
    },
    { metric: 'streaks', label: 'Longest win streak', value: hasClosed ? String(stats.winStreak) : '-' },
    { metric: 'streaks', label: 'Longest losing streak', value: hasClosed ? String(stats.lossStreak) : '-' },
    {
      metric: 'streaks',
      label: 'Current streak',
      value: stats.currentStreak.length ? `${stats.currentStreak.length} ${stats.currentStreak.type === 'win' ? 'won' : 'lost'}` : '-',
      tone: stats.currentStreak.type === 'win' ? 'positive' : stats.currentStreak.type === 'loss' ? 'negative' : 'neutral'
    },
    {
      metric: 'riskConsistency',
      label: 'Risk consistency',
      value: risk.level ? CONSISTENCY_LABEL[risk.level] : '-',
      note: risk.level
        ? `risk varies ${Math.round(risk.cv * 100)}% around average, ${risk.withStop} trades`
        : risk.withStop
          ? `needs 5+ trades with a stop loss (${risk.withStop} so far)`
          : 'needs stop losses on your trades',
      tone: risk.level ? CONSISTENCY_TONE[risk.level] : 'neutral'
    },
    ...(risk.level ? [{ metric: 'riskConsistency', label: 'Stop loss coverage', value: formatPercent(risk.stopCoverage), note: `${risk.withStop} of ${risk.closedTrades} closed trades` }] : [])
  ])

  const sideRows = visible([
    { metric: 'longShort', label: 'Long', value: money(stats.long.count ? stats.long.netPnl : null, { signed: true }), note: sideNote(stats.long), tone: stats.long.count ? toneOf(stats.long.netPnl) : 'neutral' },
    { metric: 'longShort', label: 'Short', value: money(stats.short.count ? stats.short.netPnl : null, { signed: true }), note: sideNote(stats.short), tone: stats.short.count ? toneOf(stats.short.netPnl) : 'neutral' }
  ])

  const keyStats = [
    { metric: 'totalTrades', node: <Stat key="total" label="Total trades" value={String(stats.totalTrades)} hint={`${stats.closedTrades} closed, ${stats.openTrades} open`} /> },
    { metric: 'winRate', node: <Stat key="win" label="Win rate" value={formatPercent(stats.winRate)} hint={hasClosed ? `${stats.wins} won, ${stats.losses} lost` : undefined} /> },
    {
      metric: 'profitFactor',
      node: (
        <Stat
          key="pf"
          label="Profit factor"
          value={formatRatio(stats.profitFactor)}
          hint={stats.profitFactor === Infinity ? 'no losing trades yet' : 'gross profit / gross loss'}
        />
      )
    },
    {
      metric: 'expectancy',
      node: (
        <Stat
          key="exp"
          label="Expectancy"
          value={money(stats.expectancy, { signed: true })}
          tone={toneOf(stats.expectancy)}
          hint={stats.avgR === null ? 'average per closed trade' : `average per closed trade, ${formatR(stats.avgR)}`}
        />
      )
    },
    {
      metric: 'avgRiskReward',
      node: (
        <Stat
          key="rr"
          label="Reward : risk"
          value={rewardRisk === null ? '-' : formatRatio(rewardRisk)}
          tone={rewardRisk === null ? 'neutral' : rewardRisk >= 1 ? 'positive' : 'negative'}
          hint={
            stats.rewardRisk !== null
              ? `avg winner ${formatR(stats.avgWinR)} / avg loser ${formatR(stats.avgLossR)}`
              : rewardRisk !== null
                ? 'avg win / avg loss by amount (no stop losses logged)'
                : 'needs a winning and a losing trade'
          }
        />
      )
    }
  ].filter((entry) => canViewMetric(entry.metric))

  const showMonthly = canViewMetric('monthlyPnl') && stats.monthly.length > 0
  const showCurve = canViewMetric('equityCurve')
  const excluded = [
    stats.openTrades ? `${plural(stats.openTrades, 'open trade')}` : null,
    stats.incompleteTrades ? `${plural(stats.incompleteTrades, 'trade')} with missing entry or quantity` : null
  ].filter(Boolean)

  return (
    <div className="tc-surface rounded-2xl border border-zinc-300 bg-white shadow-card dark:border-white/[0.12] dark:bg-panel dark:shadow-none">
      <div className="p-5 pb-3 sm:p-6 sm:pb-4">
        <div className="min-w-0">
          <p className="text-xs text-zinc-600 dark:text-zinc-300">Net P&amp;L</p>
          <p className={`mt-1 text-3xl font-semibold tracking-tight tabular-nums ${toneClass[toneOf(stats.netPnl)]}`}>
            {money(stats.netPnl, { signed: true })}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {plural(stats.closedTrades, 'closed trade')}
            {rangeLabel ? ` in ${rangeLabel}` : ''}
            {modeLabel ? `, ${modeLabel.toLowerCase()}` : ''}
          </p>
          {lowSample && (
            <p className="mt-2 text-xs leading-snug text-amber-900 dark:text-amber-200">
              Small sample: ratios like profit factor and expectancy swing a lot below {MIN_RELIABLE_SAMPLE} closed trades. Treat them as early signals.
            </p>
          )}
        </div>
      </div>

      {showCurve && (
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
      )}

      {keyStats.length > 0 && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-zinc-300 p-5 sm:p-6 md:grid-cols-5 dark:border-white/[0.12]">
          {keyStats.map((entry) => entry.node)}
        </div>
      )}

      <div className="grid gap-x-12 gap-y-6 border-t border-zinc-300 p-5 sm:p-6 md:grid-cols-2 dark:border-white/[0.12]">
        <MetricList title="Performance" rows={performanceRows} />
        <MetricList title="Risk and consistency" rows={riskRows} />
        <MetricList title="Long vs short" rows={sideRows} />
      </div>

      {showMonthly && (
        <div className="border-t border-zinc-300 p-5 sm:p-6 dark:border-white/[0.12]">
          <MonthlyPnl months={stats.monthly} currency={currency} />
        </div>
      )}

      {excluded.length > 0 && (
        <p className="border-t border-zinc-300 px-5 py-3 text-[11px] text-zinc-600 sm:px-6 dark:border-white/[0.12] dark:text-zinc-400">
          Not counted in these statistics: {excluded.join(', ')}.
        </p>
      )}
    </div>
  )
}

export default TradeAnalysis
