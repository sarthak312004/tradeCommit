import { useMemo } from 'react'
import { BreakdownRows, Heatmap } from './charts'
import MetricGate from './MetricGate'
import { EmptyNote, Section, toneText } from './parts'
import { computeBreakdowns, monthlyGrid, ROLE_FIELD_TYPE } from '../../../../utils/tradeBreakdowns'
import { formatMoney, formatPercent, formatR, formatRatio, toneOf } from '../../../../utils/tradeAnalytics'

const ROLE_LABELS = [
  ['strategy', 'Strategy'],
  ['setup', 'Setup / tags'],
  ['entryTime', 'Entry time'],
  ['exitDate', 'Exit date']
]

const coverage = (tracked, total) => (tracked < total ? `${tracked} of ${total} trades` : null)

function LongShortTable({ detail, currency }) {
  const money = (value, options) => formatMoney(value, { currency, ...options })
  const columns = [
    { key: 'long', label: 'Long', stats: detail.long },
    { key: 'short', label: 'Short', stats: detail.short }
  ]
  const rows = [
    { label: 'Closed trades', get: (s) => String(s.closedTrades) },
    { label: 'Win rate', get: (s) => formatPercent(s.winRate) },
    { label: 'Net P&L', get: (s) => money(s.closedTrades ? s.netPnl : null, { signed: true }), tone: (s) => (s.closedTrades ? toneOf(s.netPnl) : 'neutral') },
    { label: 'Average win', get: (s) => money(s.avgWin) },
    { label: 'Average loss', get: (s) => money(s.avgLoss === null ? null : -s.avgLoss) },
    { label: 'Profit factor', get: (s) => formatRatio(s.profitFactor) },
    { label: 'Expectancy', get: (s) => money(s.expectancy, { signed: true }), tone: (s) => toneOf(s.expectancy) },
    { label: 'Average R', get: (s) => formatR(s.avgR), tone: (s) => (s.avgR === null ? 'neutral' : toneOf(s.avgR)) },
    { label: 'Best trade', get: (s) => money(s.bestTrade, { signed: true }) },
    { label: 'Worst trade', get: (s) => money(s.worstTrade, { signed: true }) },
    { label: 'Max drawdown', get: (s) => (s.closedTrades ? money(-s.maxDrawdown) : '-') },
    { label: 'Longest win / loss streak', get: (s) => (s.closedTrades ? `${s.winStreak} / ${s.lossStreak}` : '-') }
  ]
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[18rem] text-sm">
        <thead>
          <tr className="text-xs text-zinc-600 dark:text-zinc-400">
            <th scope="col" className="py-1.5 text-left font-normal"><span className="sr-only">Metric</span></th>
            {columns.map((column) => <th key={column.key} scope="col" className="py-1.5 text-right font-medium">{column.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-300 dark:divide-white/[0.09]">
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="py-2.5 text-left font-normal text-zinc-600 dark:text-zinc-300">{row.label}</th>
              {columns.map((column) => (
                <td key={column.key} className={`py-2.5 text-right font-medium tabular-nums ${toneText[row.tone ? row.tone(column.stats) : 'neutral']}`}>
                  {row.get(column.stats)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DataSources({ roles, fields, onRoleChange }) {
  const selectClass =
    'w-full min-w-0 cursor-pointer rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-800 outline-none transition focus:border-sky-500 dark:border-white/[0.12] dark:bg-panel dark:text-zinc-100'
  return (
    <details className="group">
      <summary className="cursor-pointer text-xs font-medium text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100">
        Data sources for these breakdowns
      </summary>
      <p className="mt-2 max-w-xl text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
        A trade stores a date, not a clock time or an exit date. Strategy, setup, entry time and exit date are read from the properties you add to your trades. We picked the closest matches by name; change them here.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLE_LABELS.map(([role, label]) => {
          const choices = fields.filter((field) => field.type === ROLE_FIELD_TYPE[role])
          return (
            <label key={role} className="block min-w-0">
              <span className="mb-1 block text-[11px] text-zinc-600 dark:text-zinc-400">{label}</span>
              <select value={roles[role]} onChange={(event) => onRoleChange(role, event.target.value)} className={selectClass}>
                <option value="">Not used</option>
                {choices.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
              </select>
            </label>
          )
        })}
      </div>
    </details>
  )
}

function BreakdownTab({ trades, stats, roles, fields, onRoleChange, currency }) {
  const data = useMemo(() => computeBreakdowns(trades, roles), [trades, roles])
  const grid = useMemo(() => monthlyGrid(stats.monthly), [stats.monthly])
  if (data.closedTrades === 0) {
    return (
      <div className="p-5 sm:p-6">
        <EmptyNote title="No closed trades to break down">Close a trade by adding its exit price, or loosen the filters above.</EmptyNote>
      </div>
    )
  }

  const { dayOfWeek, timeOfDay, holding, instruments, strategies, setups, longShort } = data
  const hiddenNote = (hidden) => (hidden ? `+${hidden} more not shown` : null)

  return (
    <div className="space-y-8 p-5 sm:p-6">
      <MetricGate id="monthlyHeatmap">
        <Section title="Monthly performance" note="net P&L by month">
          {grid.length ? <Heatmap grid={grid} currency={currency} /> : <EmptyNote title="No dated closed trades" />}
        </Section>
      </MetricGate>

      <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
        <MetricGate id="dayOfWeek">
          <Section title="Day of week" note={dayOfWeek.untracked ? `${dayOfWeek.untracked} without a valid date` : null}>
            <BreakdownRows rows={dayOfWeek.rows} currency={currency} />
          </Section>
        </MetricGate>

        <MetricGate id="timeOfDay">
          <Section title="Time of day" note={coverage(timeOfDay.tracked, timeOfDay.total) && `from ${coverage(timeOfDay.tracked, timeOfDay.total)}`}>
            {timeOfDay.tracked ? (
              <BreakdownRows rows={timeOfDay.rows} currency={currency} />
            ) : (
              <EmptyNote title="Entry time not tracked">
                Add a text property such as &ldquo;Entry time&rdquo; (09:30 or 2:15 PM) to your trades, or pick one under Data sources.
              </EmptyNote>
            )}
          </Section>
        </MetricGate>
      </div>

      <MetricGate id="holdingDuration">
        <Section
          title="Holding duration"
          note={coverage(holding.tracked, holding.total) && `from ${coverage(holding.tracked, holding.total)}`}
        >
          {holding.tracked ? (
            <>
              <BreakdownRows rows={holding.rows} currency={currency} />
              <p className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                Average hold: winners {holding.avgDaysWinners === null ? '-' : `${holding.avgDaysWinners.toFixed(1)} days`}, losers {holding.avgDaysLosers === null ? '-' : `${holding.avgDaysLosers.toFixed(1)} days`}. Measured in whole days.
              </p>
            </>
          ) : (
            <EmptyNote title="Holding time not tracked">
              Add a date property such as &ldquo;Exit date&rdquo; to your trades, or pick one under Data sources. Trades closed before they were opened are ignored.
            </EmptyNote>
          )}
        </Section>
      </MetricGate>

      <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
        <MetricGate id="instrumentBreakdown">
          <Section title="Instruments" note={hiddenNote(instruments.hidden)}>
            {instruments.rows.length ? <BreakdownRows rows={instruments.rows} currency={currency} /> : <EmptyNote title="No instruments" />}
          </Section>
        </MetricGate>

        <MetricGate id="strategyBreakdown">
          <Section title="Strategies" note={hiddenNote(strategies.hidden)}>
            {strategies.rows.length ? (
              <BreakdownRows rows={strategies.rows} currency={currency} />
            ) : (
              <EmptyNote title="No strategy property">
                Add a text property called &ldquo;Strategy&rdquo; to your trades to compare strategies, or pick one under Data sources.
              </EmptyNote>
            )}
          </Section>
        </MetricGate>
      </div>

      <MetricGate id="setupBreakdown">
        <Section title="Setups and tags" note={setups.rows.length ? `${hiddenNote(setups.hidden) ?? 'comma-separated values count in each group'}` : null}>
          {setups.rows.length ? (
            <BreakdownRows rows={setups.rows} currency={currency} />
          ) : (
            <EmptyNote title="No setup property">
              Add a text property called &ldquo;Setup&rdquo; or &ldquo;Tags&rdquo; (comma-separated) to your trades, or pick one under Data sources.
            </EmptyNote>
          )}
        </Section>
      </MetricGate>

      <MetricGate id="longShortDetail">
        <Section title="Long vs short" note="same calculations as the overview">
          <LongShortTable detail={longShort} currency={currency} />
        </Section>
      </MetricGate>

      <DataSources roles={roles} fields={fields} onRoleChange={onRoleChange} />
    </div>
  )
}

export default BreakdownTab
