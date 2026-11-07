import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import EquityCurve from './EquityCurve'
import MonthlyPnl from './MonthlyPnl'
import AnalyticsBoundary from './analytics/AnalyticsBoundary'
import AnalyticsFilters from './analytics/AnalyticsFilters'
import MetricGate, { LockedBlock, NativeAnalyticsPreview, PlanCheckNotice } from './analytics/MetricGate'
import { AnalyticsAccessContext } from './analytics/accessContext'
import { DrawdownChart } from './analytics/charts'
import { EmptyNote, TabLoading } from './analytics/parts'
import { computeAnalytics, formatMoney, formatPercent, formatR, formatRatio, toneOf } from '../../../utils/tradeAnalytics'
import { MIN_RELIABLE_SAMPLE } from '../../../utils/tradeMetrics'
import { applyTradeFilters, detectFieldRoles, discoverFields, filterOptions, UNTAGGED } from '../../../utils/tradeBreakdowns'
import { accessStatus, canViewMetric, isTabLocked, lockedMetricIds, TAB_METRICS } from '../../../config/analyticsAccess'
import { useProfile } from '../../../hooks/useProfile'

// the heavier views load only when their tab is opened
const BreakdownTab = lazy(() => import('./analytics/BreakdownTab'))
const DistributionTab = lazy(() => import('./analytics/DistributionTab'))
const CompareTab = lazy(() => import('./analytics/CompareTab'))

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'breakdown', label: 'Breakdown' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'compare', label: 'Compare' }
]

const NO_FILTERS = { instrument: '', strategy: '', setup: '' }

const OVERVIEW_PRO_METRICS = [
  'profitFactor',
  'expectancy',
  'avgR',
  'bestWorstTrade',
  'maxDrawdown',
  'recoveryFactor',
  'streaks',
  'riskConsistency',
  'longShort',
  'monthlyPnl'
]

const OVERVIEW_PRO_HIGHLIGHTS = [
  'Performance (Profit factor, Expectancy, Avg R, Best & worst trade)',
  'Risk & consistency (Max drawdown, Recovery factor, Streaks)',
  'Long vs Short directional breakdown',
  'Monthly P&L performance history'
]

const TAB_LOCK_META = {
  breakdown: {
    title: 'Unlock Strategy, Setup & Time Breakdowns',
    subtitle: 'See which instruments, setups, days of the week, and sessions generate your edge.',
    highlights: [
      'Monthly performance heatmap',
      'Day of week & Time of day',
      'Holding duration',
      'Instrument, Strategy & Setup tables',
      'Long vs Short detail'
    ]
  },
  distribution: {
    title: 'Unlock P&L & R-Multiple Distributions',
    subtitle: 'Visualize the shape of your trade outcomes, tail risk, and R-multiple dispersion.',
    highlights: [
      'Winning vs losing P&L histogram',
      'Median win & median loss',
      'R-multiple distribution bands',
      'Outlier trade detection'
    ]
  },
  compare: {
    title: 'Unlock Period-over-Period Comparison',
    subtitle: 'Benchmark any two date ranges side by side to measure whether your execution is improving.',
    highlights: [
      'Period A vs Period B table',
      'Win rate, Profit factor & Expectancy deltas',
      'Average R & Drawdown change tracking'
    ]
  }
}

const saved = (list) => list.filter((trade) => trade.syncState !== 'failed')

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

function TradeAnalysis({ trades, allTrades, range, currency, rangeLabel, mode }) {
  const money = (value, options) => formatMoney(value, { currency, ...options })
  const [tab, setTab] = useState('overview')
  const [filters, setFilters] = useState(NO_FILTERS)
  const [roleOverride, setRoleOverride] = useState({})

  // What this user may see comes from the server (profile.entitlements.metricAccess). Until it arrives nothing is
  // drawn as locked or unlocked: the panels show a skeleton.
  const { profile, error: profileError, retry: retryProfile } = useProfile()
  const entitlements = profile?.entitlements ?? null
  const status = accessStatus({ profile, error: profileError })
  const ready = status === 'ready'
  const access = useMemo(() => ({ status, entitlements, retry: retryProfile }), [status, entitlements, retryProfile])
  const can = useCallback((metricId) => canViewMetric(metricId, entitlements), [entitlements])
  // Filters remain available on Free; a plan change mid-session must not keep filtering silently.
  const activeFilters = ready && can('analyticsFilters') ? filters : NO_FILTERS

  // a trade that failed to save (shown with Retry / Discard) isn't in the journal yet, so it stays out of the numbers
  const inRange = useMemo(() => saved(trades), [trades])
  // every date of this journal: used to discover properties, fill the filters and compare periods
  const everything = useMemo(() => saved(allTrades ?? trades), [allTrades, trades])

  const fields = useMemo(() => discoverFields(everything), [everything])
  const detectedRoles = useMemo(() => detectFieldRoles(fields), [fields])
  const roles = useMemo(() => ({ ...detectedRoles, ...roleOverride }), [detectedRoles, roleOverride])
  const options = useMemo(() => filterOptions(everything, roles), [everything, roles])

  // ONE filtered list feeds the overview, every breakdown and every chart, so they cannot disagree
  const filtered = useMemo(() => applyTradeFilters(inRange, activeFilters, roles), [inRange, activeFilters, roles])
  const comparable = useMemo(() => applyTradeFilters(everything, activeFilters, roles), [everything, activeFilters, roles])
  const stats = useMemo(() => computeAnalytics(filtered), [filtered])
  const filtersActive = Boolean(activeFilters.instrument || activeFilters.strategy || activeFilters.setup)
  const filterLabel = [activeFilters.instrument, activeFilters.strategy === UNTAGGED ? 'no strategy' : activeFilters.strategy, activeFilters.setup === UNTAGGED ? 'no setup' : activeFilters.setup].filter(Boolean).join(', ')
  const hasClosed = stats.closedTrades > 0
  // reward-to-risk in R when stops are logged, otherwise the same idea by amount
  const rewardRisk = stats.rewardRisk ?? stats.payoffRatio
  const risk = stats.riskConsistency
  const lowSample = hasClosed && !stats.sample.reliable
  const modeLabel = mode === 'backtest' ? 'Backtest journal' : mode === 'live' ? 'Live journal' : null
  const rSampleHint = stats.rSample > 0 && stats.rSample < stats.closedTrades ? `from ${stats.rSample} of ${stats.closedTrades} trades with a stop loss` : null

  const split = (entries) => ({
    rows: entries.filter((entry) => can(entry.metric)),
    locked: lockedMetricIds(entries.map((entry) => entry.metric), entitlements)
  })

  const sideNote = (side) => (side.count ? `${plural(side.count, 'trade')}, ${formatPercent(side.winRate)} win` : 'no trades')

  // Basic metrics row (all 5 free and accessible in the same row)
  const basicStats = [
    {
      metric: 'totalTrades',
      node: <Stat key="total" label="Total trades" value={String(stats.totalTrades)} hint={`${stats.closedTrades} closed, ${stats.openTrades} open`} />
    },
    {
      metric: 'winRate',
      node: <Stat key="win" label="Win rate" value={formatPercent(stats.winRate)} hint={hasClosed ? `${stats.wins} won, ${stats.losses} lost` : undefined} />
    },
    {
      metric: 'avgWinLoss',
      node: (
        <Stat
          key="payoff"
          label="Payoff ratio"
          value={formatRatio(stats.payoffRatio)}
          tone={stats.payoffRatio === null ? 'neutral' : stats.payoffRatio >= 1 ? 'positive' : 'negative'}
          hint={
            stats.avgWin !== null && stats.avgLoss !== null
              ? `${money(stats.avgWin)} avg win / ${money(-stats.avgLoss)} avg loss`
              : 'avg win / avg loss, by amount'
          }
        />
      )
    },
    {
      metric: 'avgRiskReward',
      node: (
        <Stat
          key="rr"
          label="Risk to reward"
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
    },
    {
      metric: 'winsLosses',
      node: (
        <Stat
          key="wl"
          label="Winners / losers"
          value={hasClosed ? `${stats.wins} / ${stats.losses}` : '-'}
          hint={stats.breakevenTrades ? `${stats.breakevenTrades} breakeven` : hasClosed ? `${plural(stats.closedTrades, 'closed trade')}` : 'no closed trades yet'}
        />
      )
    }
  ]
  const basicGroup = split(basicStats)

  // Pro section below the basic row (Performance, Risk and consistency, Long vs short, Monthly P&L)
  const performanceGroup = split([
    {
      metric: 'profitFactor',
      label: 'Profit factor',
      value: formatRatio(stats.profitFactor),
      note: stats.profitFactor === Infinity ? 'no losing trades yet' : 'gross profit / gross loss',
      tone: stats.profitFactor === null ? 'neutral' : stats.profitFactor >= 1 ? 'positive' : 'negative'
    },
    {
      metric: 'expectancy',
      label: 'Expectancy',
      value: money(stats.expectancy, { signed: true }),
      note: stats.avgR === null ? 'average per closed trade' : `average per closed trade, ${formatR(stats.avgR)}`,
      tone: toneOf(stats.expectancy)
    },
    ...(can('profitFactor') || can('expectancy') || can('bestWorstTrade') || can('avgR')
      ? [
          { metric: 'avgWinLoss', label: 'Average win', value: money(stats.avgWin), tone: stats.avgWin ? 'positive' : 'neutral' },
          { metric: 'avgWinLoss', label: 'Average loss', value: money(stats.avgLoss === null ? null : -stats.avgLoss), tone: stats.avgLoss ? 'negative' : 'neutral' }
        ]
      : []),
    { metric: 'avgR', label: 'Average R', value: formatR(stats.avgR), note: rSampleHint ?? 'per trade with a stop loss', tone: stats.avgR === null ? 'neutral' : toneOf(stats.avgR) },
    { metric: 'bestWorstTrade', label: 'Best trade', value: money(stats.bestTrade, { signed: true }), tone: toneOf(stats.bestTrade) },
    { metric: 'bestWorstTrade', label: 'Worst trade', value: money(stats.worstTrade, { signed: true }), tone: toneOf(stats.worstTrade) }
  ])

  const riskGroup = split([
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

  const sideGroup = split([
    { metric: 'longShort', label: 'Long', value: money(stats.long.count ? stats.long.netPnl : null, { signed: true }), note: sideNote(stats.long), tone: stats.long.count ? toneOf(stats.long.netPnl) : 'neutral' },
    { metric: 'longShort', label: 'Short', value: money(stats.short.count ? stats.short.netPnl : null, { signed: true }), note: sideNote(stats.short), tone: stats.short.count ? toneOf(stats.short.netPnl) : 'neutral' }
  ])

  const overviewProLocked = lockedMetricIds(OVERVIEW_PRO_METRICS, entitlements)
  const hasUnlockedProRows = performanceGroup.rows.length > 0 || riskGroup.rows.length > 0 || sideGroup.rows.length > 0
  const hasMonthly = stats.monthly.length > 0
  const excluded = [
    stats.openTrades ? `${plural(stats.openTrades, 'open trade')}` : null,
    stats.incompleteTrades ? `${plural(stats.incompleteTrades, 'trade')} with missing entry or quantity` : null
  ].filter(Boolean)

  const tabLockMeta = TAB_LOCK_META[tab] ?? {}

  // whole panel: a skeleton while loading, one notice when the plan could not be read, one seamless blur overlay when
  // the server locks every metric of the tab (the tab itself stays visible)
  const panelNotice = !ready ? (
    status === 'error' ? (
      <div className="p-5 sm:p-6"><PlanCheckNotice /></div>
    ) : (
      <TabLoading />
    )
  ) : isTabLocked(tab, entitlements) ? (
    <LockedBlock
      ids={TAB_METRICS[tab]}
      title={tabLockMeta.title}
      subtitle={tabLockMeta.subtitle}
      highlights={tabLockMeta.highlights}
    />
  ) : null

  return (
    <AnalyticsAccessContext.Provider value={access}>
    <div className="tc-surface rounded-2xl border border-zinc-300 bg-white shadow-card dark:border-white/[0.12] dark:bg-panel dark:shadow-none">
      {/* Header row: Net P&L on the left, View Tabs (Overview, Breakdown, Distribution, Compare) on the right */}
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 pb-3 sm:p-6 sm:pb-4">
        <div className="min-w-0">
          <p className="text-xs text-zinc-600 dark:text-zinc-300">Net P&amp;L</p>
          {!ready ? (
            <div aria-hidden="true" className="mt-2 h-8 w-40 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.05]" />
          ) : can('netPnl') ? (
            <p className={`mt-1 text-3xl font-semibold tracking-tight tabular-nums ${toneClass[toneOf(stats.netPnl)]}`}>
              {money(stats.netPnl, { signed: true })}
            </p>
          ) : (
            <LockedBlock ids={['netPnl']} compact className="mt-2" />
          )}
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {plural(stats.closedTrades, 'closed trade')}
            {rangeLabel ? ` in ${rangeLabel}` : ''}
            {modeLabel ? `, ${modeLabel.toLowerCase()}` : ''}
            {filterLabel ? `, filtered to ${filterLabel}` : ''}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Analysis views"
          className="flex items-center gap-1 self-start overflow-x-auto rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-1 dark:border-white/[0.08] dark:bg-white/[0.03]"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`analysis-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls="analysis-panel"
              onClick={() => setTab(item.id)}
              className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                tab === item.id
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-white/[0.1] dark:text-zinc-100 dark:shadow-none'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters bar */}
      <div className="border-t border-zinc-300 px-5 pt-3 sm:px-6 dark:border-white/[0.12]">
        {lowSample && (
          <p className="mb-3 text-xs leading-snug text-sky-800 dark:text-sky-300">
            Small sample: ratios like profit factor and expectancy swing a lot below {MIN_RELIABLE_SAMPLE} closed trades. Treat them as early signals.
          </p>
        )}
        <MetricGate id="analyticsFilters" variant="inline" className="pb-4">
          <div className="pb-4">
            <AnalyticsFilters filters={filters} onChange={setFilters} options={options} hasStrategy={Boolean(roles.strategy)} hasSetup={Boolean(roles.setup)} />
            {tab === 'compare' && filtersActive && (
              <p className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400">Filters apply here too. The date range above is replaced by the two periods below.</p>
            )}
          </div>
        </MetricGate>
      </div>

      <div id="analysis-panel" role="tabpanel" aria-labelledby={`analysis-tab-${tab}`} className="border-t border-zinc-300 dark:border-white/[0.12]">
        <AnalyticsBoundary key={tab}>
          {panelNotice ?? (
          <>
          {tab === 'overview' && (
            <>
            <div className="px-3 pb-4 pt-4 sm:px-4">
              <MetricGate id="equityCurve">
                {hasClosed ? (
                  <>
                    <EquityCurve points={stats.equity} currency={currency} />
                    <div className="px-2 pt-3 sm:px-3">
                      <MetricGate id="drawdownChart" variant="chart">
                        <DrawdownChart points={stats.equity} currency={currency} />
                      </MetricGate>
                    </div>
                  </>
                ) : (
                  <div className="grid h-52 place-items-center px-6 text-center">
                    <div>
                      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">No closed trades to chart</p>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Add an exit price to a trade and its result shows up here.</p>
                    </div>
                  </div>
                )}
              </MetricGate>
            </div>

            {basicGroup.rows.length > 0 && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-zinc-300 p-5 sm:p-6 md:grid-cols-5 dark:border-white/[0.12]">
                {basicGroup.rows.map((entry) => entry.node)}
              </div>
            )}

            {hasUnlockedProRows && (
              <div className="grid gap-x-12 gap-y-6 border-t border-zinc-300 p-5 sm:p-6 md:grid-cols-2 dark:border-white/[0.12]">
                <MetricList title="Performance" rows={performanceGroup.rows} />
                <MetricList title="Risk and consistency" rows={riskGroup.rows} />
                <MetricList title="Long vs short" rows={sideGroup.rows} />
              </div>
            )}

            {hasMonthly && can('monthlyPnl') && (
              <div className="border-t border-zinc-300 p-5 sm:p-6 dark:border-white/[0.12]">
                <MonthlyPnl months={stats.monthly} currency={currency} />
              </div>
            )}

            {overviewProLocked.length > 0 && (
              <div className="border-t border-zinc-300 dark:border-white/[0.12]">
                <LockedBlock
                  ids={overviewProLocked}
                  title="Unlock Performance, Risk, Long vs Short & Monthly P&L"
                  subtitle="Upgrade to Pro to unlock full performance ratios, risk & streak consistency, directional splits, and month-by-month P&L history."
                  highlights={OVERVIEW_PRO_HIGHLIGHTS}
                >
                  <NativeAnalyticsPreview />
                </LockedBlock>
              </div>
            )}

            {excluded.length > 0 && (
              <p className="border-t border-zinc-300 px-5 py-3 text-[11px] text-zinc-600 sm:px-6 dark:border-white/[0.12] dark:text-zinc-400">
                Not counted in these statistics: {excluded.join(', ')}.
              </p>
            )}
            </>
          )}

          {tab !== 'overview' && filtered.length === 0 && tab !== 'compare' ? (
            <div className="p-5 sm:p-6">
              <EmptyNote title={filtersActive ? 'No trades match these filters' : 'No trades to analyse'}>
                {filtersActive ? 'Clear a filter, or widen the date range of the journal.' : 'Log a trade and close it with an exit price.'}
              </EmptyNote>
            </div>
          ) : (
            <Suspense fallback={<TabLoading />}>
              {tab === 'breakdown' && (
                <BreakdownTab
                  trades={filtered}
                  stats={stats}
                  roles={roles}
                  fields={fields}
                  onRoleChange={(role, value) => setRoleOverride((current) => ({ ...current, [role]: value }))}
                  currency={currency}
                />
              )}
              {tab === 'distribution' && <DistributionTab trades={filtered} currency={currency} />}
              {tab === 'compare' && <CompareTab trades={comparable} range={range} currency={currency} />}
            </Suspense>
          )}
          </>
          )}
        </AnalyticsBoundary>
      </div>
    </div>
    </AnalyticsAccessContext.Provider>
  )
}

export default TradeAnalysis
