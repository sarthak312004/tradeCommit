import { useMemo, useState } from 'react'
import MetricGate from './MetricGate'
import { EmptyNote, Section, toneText } from './parts'
import { addDaysToKey, compareRanges, isValidRange, previousRange } from '../../../../utils/tradeBreakdowns'
import { dateKeyFromDate, formatMoney, formatPercent, formatR, formatRatio, toneOf } from '../../../../utils/tradeAnalytics'

const inputClass =
  'w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-800 outline-none transition focus:border-sky-500 dark:border-white/[0.12] dark:bg-panel dark:text-zinc-100'

// start: the journal's active date range when there is one, otherwise the last 30 days vs the 30 before
const initialPeriods = (range) => {
  if (isValidRange(range)) return { a: { from: range.from, to: range.to }, b: previousRange(range) }
  const today = dateKeyFromDate(new Date())
  const a = { from: addDaysToKey(today, -29), to: today }
  return { a, b: previousRange(a) }
}

function PeriodInputs({ label, period, onChange }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <input aria-label={`${label} start`} type="date" value={period.from} max={period.to || undefined} onChange={(event) => onChange({ ...period, from: event.target.value })} className={inputClass} />
        <input aria-label={`${label} end`} type="date" value={period.to} min={period.from || undefined} onChange={(event) => onChange({ ...period, to: event.target.value })} className={inputClass} />
      </div>
    </fieldset>
  )
}

function CompareTab({ trades, range, currency }) {
  const [periods, setPeriods] = useState(() => initialPeriods(range))
  const validA = isValidRange(periods.a)
  const validB = isValidRange(periods.b)
  const result = useMemo(() => (validA && validB ? compareRanges(trades, periods.a, periods.b) : null), [trades, periods, validA, validB])

  const money = (value, options) => formatMoney(value, { currency, ...options })

  // `better`: which direction is good. 'down' = lower is better (drawdown, average loss)
  const rows = [
    { label: 'Closed trades', get: (s) => s.closedTrades, show: (v) => String(v), diff: (d) => (d > 0 ? `+${d}` : String(d)), better: null },
    { label: 'Net P&L', get: (s) => (s.closedTrades ? s.netPnl : null), show: (v) => money(v, { signed: true }), diff: (d) => money(d, { signed: true }), better: 'up' },
    { label: 'Win rate', get: (s) => s.winRate, show: formatPercent, diff: (d) => `${d > 0 ? '+' : ''}${(d * 100).toFixed(0)} pts`, better: 'up' },
    { label: 'Profit factor', get: (s) => s.profitFactor, show: formatRatio, diff: (d) => `${d > 0 ? '+' : ''}${d.toFixed(2)}`, better: 'up' },
    { label: 'Expectancy', get: (s) => s.expectancy, show: (v) => money(v, { signed: true }), diff: (d) => money(d, { signed: true }), better: 'up' },
    { label: 'Average R', get: (s) => s.avgR, show: formatR, diff: (d) => formatR(d), better: 'up' },
    { label: 'Average win', get: (s) => s.avgWin, show: (v) => money(v), diff: (d) => money(d, { signed: true }), better: 'up' },
    { label: 'Average loss', get: (s) => (s.avgLoss === null ? null : -s.avgLoss), show: (v) => money(v), diff: (d) => money(d, { signed: true }), better: 'up' },
    { label: 'Max drawdown', get: (s) => (s.closedTrades ? s.maxDrawdown : null), show: (v) => (v === null ? '-' : money(-v)), diff: (d) => money(d, { signed: true }), better: 'down' }
  ]

  const change = (row) => {
    const a = row.get(result.a)
    const b = row.get(result.b)
    // an infinite or missing value has no meaningful difference
    if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return { text: '-', tone: 'neutral' }
    const delta = a - b
    if (Math.abs(delta) < 1e-9) return { text: row.diff(0).replace(/^\+/, ''), tone: 'neutral' }
    const tone = row.better === null ? 'neutral' : toneOf(row.better === 'up' ? delta : -delta)
    return { text: row.diff(delta), tone }
  }

  return (
    <div className="space-y-6 p-5 sm:p-6">
      <MetricGate id="rangeComparison">
        <Section title="Compare two periods" note="uses its own dates; instrument, strategy and setup filters still apply">
          <div className="grid gap-4 sm:grid-cols-2">
            <PeriodInputs label="Period A" period={periods.a} onChange={(a) => setPeriods((current) => ({ ...current, a }))} />
            <PeriodInputs label="Period B" period={periods.b} onChange={(b) => setPeriods((current) => ({ ...current, b }))} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <button
              type="button"
              disabled={!validA}
              onClick={() => setPeriods((current) => ({ ...current, b: previousRange(current.a) }))}
              className="cursor-pointer text-xs font-medium text-sky-800 underline-offset-2 transition hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-sky-300"
            >
              Set B to the period before A
            </button>
            <button
              type="button"
              onClick={() => setPeriods(initialPeriods(range))}
              className="cursor-pointer text-xs font-medium text-sky-800 underline-offset-2 transition hover:underline dark:text-sky-300"
            >
              Reset
            </button>
          </div>

          {!result ? (
            <div className="mt-4">
              <EmptyNote title="Choose a start and end date for both periods">The start date must be on or before the end date.</EmptyNote>
            </div>
          ) : result.a.closedTrades === 0 && result.b.closedTrades === 0 ? (
            <div className="mt-4">
              <EmptyNote title="No closed trades in either period">Try wider dates, or clear the instrument, strategy and setup filters.</EmptyNote>
            </div>
          ) : (
            <>
              {result.overlap && <p className="mt-3 text-xs text-amber-900 dark:text-amber-200">These periods overlap, so some trades count in both.</p>}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[22rem] text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-600 dark:text-zinc-400">
                      <th scope="col" className="py-1.5 text-left font-normal"><span className="sr-only">Metric</span></th>
                      <th scope="col" className="py-1.5 text-right font-medium">A</th>
                      <th scope="col" className="py-1.5 text-right font-medium">B</th>
                      <th scope="col" className="py-1.5 text-right font-medium">A vs B</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-300 dark:divide-white/[0.09]">
                    {rows.map((row) => {
                      const delta = change(row)
                      return (
                        <tr key={row.label}>
                          <th scope="row" className="py-2.5 text-left font-normal text-zinc-600 dark:text-zinc-300">{row.label}</th>
                          <td className="py-2.5 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{row.show(row.get(result.a))}</td>
                          <td className="py-2.5 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{row.show(row.get(result.b))}</td>
                          <td className={`py-2.5 text-right font-medium tabular-nums ${toneText[delta.tone]}`}>{delta.text}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Section>
      </MetricGate>
    </div>
  )
}

export default CompareTab
