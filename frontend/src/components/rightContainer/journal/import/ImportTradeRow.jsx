import { memo } from 'react'
import { formatDateKey } from '../../../../utils/tradeAnalytics'
import { KIND_META, checkboxClass, rowGrid, sideChip, toneText } from './importStyles'
import { focusRing } from '../../../common/controlStyles'

const number = (value, digits = 4) => Number(value).toLocaleString(undefined, { maximumFractionDigits: digits })

function ImportTradeRow({ trade, kind, checked, onToggle, onCycleKind }) {
  const meta = KIND_META[kind]
  const hasExit = trade.exitPrice !== null && trade.exitPrice !== undefined
  const pnlTone = !hasExit || trade.pnl === null ? 'neutral' : trade.pnl > 0 ? 'positive' : trade.pnl < 0 ? 'negative' : 'neutral'
  const sameDay = !trade.exitDate || trade.exitDate === trade.date

  return (
    <li
      style={{ '--cols': rowGrid }}
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-zinc-200 px-4 py-2.5 transition-colors last:border-b-0 md:grid-cols-[var(--cols)] dark:border-white/[0.07] ${
        checked ? 'bg-transparent' : 'bg-zinc-50/70 opacity-60 dark:bg-white/[0.02]'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(trade.id)}
        aria-label={`Import ${trade.symbol} on ${trade.date}`}
        className={`${checkboxClass} md:row-start-1`}
      />

      <div className="min-w-0 md:row-start-1">
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-50" title={trade.symbol}>{trade.symbol}</span>
          <span className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-medium capitalize ${sideChip[trade.direction]}`}>{trade.direction}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400">
          {formatDateKey(trade.date, { withYear: true })}
          {!sameDay && <span> → {formatDateKey(trade.exitDate, { withYear: true })}</span>}
        </p>
      </div>

      <p className={`text-right text-[13px] font-semibold tabular-nums md:col-start-4 md:row-start-1 ${toneText[pnlTone]}`}>
        {hasExit && trade.pnl !== null ? `${trade.pnl > 0 ? '+' : ''}${number(trade.pnl, 2)}` : 'Open'}
      </p>

      <p className="col-span-2 col-start-2 min-w-0 truncate text-[13px] tabular-nums text-zinc-800 md:col-span-1 md:col-start-3 md:row-start-1 dark:text-zinc-200">
        {number(trade.quantity)} <span className="text-zinc-500 dark:text-zinc-400">@</span> {number(trade.entryPrice)}
        <span className="text-zinc-500 dark:text-zinc-400"> → </span>
        {hasExit ? number(trade.exitPrice) : <span className="text-zinc-600 dark:text-zinc-400">open</span>}
      </p>

      <div className="col-start-2 md:col-start-5 md:row-start-1">
        <button
          type="button"
          onClick={() => onCycleKind(trade.id)}
          title={`${trade.kindReason}. Click to change.`}
          aria-label={`Trade type: ${meta.label}. ${trade.kindReason}. Click to change.`}
          className={`inline-flex h-6 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium transition-colors ${meta.chip} ${focusRing}`}
        >
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </button>
      </div>

    </li>
  )
}

export default memo(ImportTradeRow)
