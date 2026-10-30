import { useMemo } from 'react'
import { Histogram } from './charts'
import MetricGate from './MetricGate'
import { EmptyNote, Section } from './parts'
import { getClosedRecords } from '../../../../utils/tradeMetrics'
import { pnlDistribution, rDistribution } from '../../../../utils/tradeBreakdowns'
import { formatMoney, formatR } from '../../../../utils/tradeAnalytics'

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

function DistributionTab({ trades, currency }) {
  const { pnl, r, closedCount } = useMemo(() => {
    const closed = getClosedRecords(trades)
    return { pnl: pnlDistribution(closed), r: rDistribution(closed), closedCount: closed.length }
  }, [trades])
  const money = (value, options) => formatMoney(value, { currency, ...options })

  if (closedCount === 0) {
    return (
      <div className="p-5 sm:p-6">
        <EmptyNote title="No closed trades to chart">Close a trade by adding its exit price, or loosen the filters above.</EmptyNote>
      </div>
    )
  }

  const pnlBins = pnl.bins
  const hasPnlBins = pnlBins.length > 0

  return (
    <div className="space-y-8 p-5 sm:p-6">
      <MetricGate id="pnlDistribution">
        <Section
          title="Winning vs losing trades"
          note={`${plural(pnl.wins, 'win')}, ${plural(pnl.losses, 'loss')}${pnl.breakeven ? `, ${pnl.breakeven} breakeven not shown` : ''}`}
        >
          {hasPnlBins ? (
            <>
              <Histogram
                bins={pnlBins}
                ariaLabel={`Distribution of trade results: ${pnl.wins} winners and ${pnl.losses} losers.`}
                labelOf={(bin) => money(bin.from, { compact: true })}
                titleOf={(bin) => `${money(bin.from)} to ${money(bin.to)}: ${plural(bin.count, 'trade')}`}
              />
              <p className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                Number of trades per result band (labels show the start of each band).
                {pnl.medianWin !== null && ` Median win ${money(pnl.medianWin)}.`}
                {pnl.medianLoss !== null && ` Median loss ${money(pnl.medianLoss)}.`}
              </p>
            </>
          ) : (
            <EmptyNote title="Only breakeven trades so far">There are no winners or losers to compare yet.</EmptyNote>
          )}
        </Section>
      </MetricGate>

      <MetricGate id="rMultipleDistribution">
        <Section title="R-multiple distribution" note={r.sample ? `from ${plural(r.sample, 'trade')} with a stop loss` : null}>
          {r.sample > 0 ? (
            <>
              <Histogram
                bins={r.bins}
                ariaLabel={`Distribution of R multiples across ${r.sample} trades.`}
                labelOf={(bin) => (bin.from === null ? `≤${bin.to}` : bin.to === null ? `≥${bin.from}` : String(bin.from))}
                titleOf={(bin) => `${bin.label}: ${plural(bin.count, 'trade')}`}
              />
              <p className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                Trades per R band (labels show the start of each band). Average {formatR(r.avgR)}, median {formatR(r.medianR)}, best {formatR(r.bestR)}, worst {formatR(r.worstR)}.
                {r.withoutStop > 0 && ` ${plural(r.withoutStop, 'trade')} without a stop loss ${r.withoutStop === 1 ? 'is' : 'are'} left out.`}
              </p>
              {r.sample < 10 && (
                <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">Only {plural(r.sample, 'trade')} so far, so the shape is not meaningful yet.</p>
              )}
            </>
          ) : (
            <EmptyNote title="No R multiples yet">R needs a stop loss on the trade. Log one and it shows up here.</EmptyNote>
          )}
        </Section>
      </MetricGate>
    </div>
  )
}

export default DistributionTab
