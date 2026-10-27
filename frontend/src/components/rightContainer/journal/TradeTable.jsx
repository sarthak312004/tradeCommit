import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon, EyeIcon, EyeOffIcon, TrashIcon } from '../../../utils/Icons.jsx'
import { DEFAULT_CURRENCY } from '../../../utils/currencies'
import { formatDateKey, formatMoney, formatR, getTradePnl, getTradeR, toDateKey, toneOf } from '../../../utils/tradeAnalytics'
import { DEFAULT_CARD_FIELDS, formatSignedPercent, getTradeReturn } from '../../../utils/tradeCardFields'
import TradeCardFieldEditor, { PencilIcon } from './TradeCardFieldEditor'
import { useHidePnl } from '../../../hooks/useHidePnl'

// details that give the result away, hidden together with the P&L
const RESULT_FIELD_IDS = new Set(['rMultiple', 'returnPct'])
const MASK = '\u2022\u2022\u2022\u2022'

// one grid for the header and every row, so the columns line up (below md: asset | result | actions)
// md and up: asset | status | date | size | result | actions (size and result are right-aligned numbers)
const COLUMNS = 'grid grid-cols-[minmax(0,1fr)_auto_5.25rem] md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_5.25rem]'

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const sideChip = {
  long: 'bg-emerald-500/[0.14] text-emerald-800 dark:text-emerald-300',
  short: 'bg-rose-500/[0.14] text-rose-800 dark:text-rose-300'
}

const toneText = {
  positive: 'text-emerald-700 dark:text-emerald-400',
  negative: 'text-rose-700 dark:text-rose-400',
  neutral: 'text-zinc-900 dark:text-zinc-50'
}

function Detail({ label, value, tone = 'neutral', wide = false, empty = false }) {
  return (
    <div className={`min-w-0 ${wide ? 'col-span-full' : ''}`}>
      <dt className="text-[11px] font-medium uppercase leading-4 tracking-wide text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd
        className={`mt-0.5 text-[13px] font-semibold leading-5 tabular-nums ${empty ? 'text-zinc-500 dark:text-zinc-500' : toneText[tone] ?? toneText.neutral} ${wide ? 'line-clamp-2 break-words font-medium' : 'truncate'}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * One trade as a borderless table row. Essentials (asset, direction, status, date, result) are always visible.
 * Hovering the row (or focusing it, or tapping its arrow on touch screens) opens the same panel as the card view,
 * with up to 3 chosen details and the pencil to change them. The panel floats over the rows below, so nothing jumps.
 */
function TradeRow({ trade, currency = DEFAULT_CURRENCY, detailFields = [], fieldIds = [], fieldChoices = [], onFieldsChange, onSelect, onDelete, onRetry, onDiscard }) {
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isPnlHidden, togglePnl] = useHidePnl()
  const wrapperRef = useRef(null)
  const pencilRef = useRef(null)
  const side = String(trade.side ?? trade.direction ?? '').toLowerCase()
  const direction = side === 'long' ? 'Long' : side === 'short' ? 'Short' : 'Unspecified'
  const isOpen = String(trade.status ?? '').toLowerCase() === 'open' || trade.exit == null || trade.exit === ''
  const isSaving = trade.syncState === 'saving'
  const isFailed = trade.syncState === 'failed'
  const isNewTrade = String(trade.id).startsWith('pending-')

  const pnl = getTradePnl(trade)
  const pnlTone = toneOf(pnl)
  const secondary = [getTradeR(trade) !== null ? formatR(getTradeR(trade)) : null, getTradeReturn(trade) !== null ? formatSignedPercent(getTradeReturn(trade)) : null].filter(Boolean)
  const dateText = formatDateKey(toDateKey(trade.date), { withYear: false }) || trade.date

  // position size (entry x quantity), with the quantity under it
  const entryPrice = toNumber(trade.entryPrice ?? trade.entry)
  const quantity = toNumber(trade.quantity ?? trade.qty)
  const size = entryPrice !== null && quantity !== null ? Math.abs(entryPrice * quantity) : null

  const details = useMemo(
    () => detailFields
      .map((field) => {
        const detail = field.get(trade, currency)
        // a field this trade has no value for keeps its slot (shown as a dash), so every dropdown has the same shape
        if (!detail) return { id: field.id, label: field.label, wide: field.wide, text: '\u2014', tone: 'neutral', empty: true }
        const masked = isPnlHidden && RESULT_FIELD_IDS.has(field.id)
        return { id: field.id, label: field.label, wide: field.wide, ...detail, ...(masked ? { text: MASK, tone: 'neutral' } : {}) }
      }),
    [detailFields, trade, currency, isPnlHidden]
  )
  const hasDetails = !isDeleteConfirmationOpen

  useEffect(() => {
    if (!isEditing) return undefined
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setIsEditing(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isEditing])

  const finishEditing = () => {
    setIsEditing(false)
    requestAnimationFrame(() => pencilRef.current?.focus())
  }

  const handleRowKeyDown = (event) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(trade)
    }
  }

  const handleDelete = async (event) => {
    event.stopPropagation()
    setIsDeleting(true)
    setDeleteError('')
    try {
      await onDelete(trade.id)
      setIsDeleteConfirmationOpen(false)
    } catch (error) {
      setDeleteError(error.message || 'Could not delete this trade. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const open = hasDetails && (isPinned || isEditing)
  const statusDot = (
    <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${isOpen ? 'bg-amber-500 dark:bg-amber-400' : 'bg-zinc-400 dark:bg-zinc-500'}`} />
  )

  return (
    <div
      ref={wrapperRef}
      role="listitem"
      className={`group/chip relative border-b border-zinc-900/[0.09] last:border-b-0 hover:z-20 hover:border-b-transparent has-[+*:hover]:border-b-transparent has-[:focus-visible]:z-20 has-[:focus-visible]:border-b-transparent has-[+*:has(:focus-visible)]:border-b-transparent dark:border-white/[0.08] ${open ? 'z-20 border-b-transparent' : ''}`}
    >
      <article
        role="button"
        tabIndex="0"
        onClick={() => onSelect(trade)}
        onKeyDown={handleRowKeyDown}
        aria-busy={isSaving}
        className={`relative ${COLUMNS} cursor-pointer items-center gap-x-4 rounded-xl border border-transparent px-[11px] py-[9px] text-left transition-[background-color,border-color,border-radius] hover:border-zinc-300 hover:bg-white group-has-[:focus-visible]/chip:border-zinc-300 group-has-[:focus-visible]/chip:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:hover:border-zinc-700 dark:hover:bg-panel-hi dark:group-has-[:focus-visible]/chip:border-zinc-700 dark:group-has-[:focus-visible]/chip:bg-panel-hi dark:focus-visible:ring-sky-400 ${
          hasDetails ? 'hover:rounded-b-none group-has-[:focus-visible]/chip:rounded-b-none' : ''
        } ${open ? 'rounded-b-none border-zinc-300 bg-white dark:border-zinc-700 dark:bg-panel-hi' : ''}`}
      >
        {/* asset: symbol + direction (status and date sit under it on small screens) */}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{trade.symbol}</p>
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${sideChip[side] ?? 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300'}`}>
              {direction}
            </span>
          </div>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-zinc-600 md:hidden dark:text-zinc-400">
            {statusDot}
            <span className="truncate">
              {trade.status}
              <span aria-hidden="true" className="mx-1.5">&middot;</span>
              {dateText}
            </span>
          </p>
        </div>

        {/* status */}
        <p className="hidden min-w-0 items-center gap-1.5 text-[13px] text-zinc-700 md:flex dark:text-zinc-300">
          {statusDot}
          <span className="truncate">{trade.status}</span>
        </p>

        {/* date */}
        <p className="hidden min-w-0 truncate text-[13px] tabular-nums text-zinc-700 md:block dark:text-zinc-300">{dateText}</p>

        {/* size: position size, quantity under it */}
        <div className="hidden min-w-0 text-right md:block">
          <p className={`text-[13px] font-medium leading-5 tabular-nums ${size === null ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-50'}`}>
            {size === null ? '-' : formatMoney(size, { currency })}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">{quantity === null ? '\u00a0' : `Qty ${quantity}`}</p>
        </div>

        {/* result */}
        <div className="min-w-0 text-right">
          {isSaving ? (
            <span role="status" className="flex items-center justify-end gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
              Saving...
            </span>
          ) : (
            <>
              <p className={`text-sm font-semibold leading-5 tabular-nums ${pnl === null ? 'text-zinc-500 dark:text-zinc-400' : isPnlHidden ? toneText.neutral : toneText[pnlTone]}`}>
                {pnl === null ? '-' : isPnlHidden ? MASK : formatMoney(pnl, { signed: true, currency })}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                {isPnlHidden && secondary.length ? MASK : secondary.length ? secondary.join(' \u00b7 ') : isOpen ? 'No exit yet' : '\u00a0'}
              </p>
            </>
          )}
        </div>

        {/* small actions */}
        <div className="flex items-center justify-end gap-0.5">
          {!trade.syncState && (
            <button
              type="button"
              title={isPnlHidden ? 'Show P&L' : 'Hide P&L'}
              aria-label={isPnlHidden ? 'Show P&L on all trades' : 'Hide P&L on all trades'}
              aria-pressed={isPnlHidden}
              onClick={(event) => {
                event.stopPropagation()
                togglePnl()
              }}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-800 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 group-hover/chip:opacity-100 pointer-coarse:opacity-100 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100 dark:focus-visible:ring-sky-400"
            >
              {isPnlHidden ? <EyeOffIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
            </button>
          )}

          {!trade.syncState && hasDetails && (
            <button
              type="button"
              aria-expanded={open}
              aria-label={`${open ? 'Hide' : 'Show'} details for ${trade.symbol}`}
              onClick={(event) => {
                event.stopPropagation()
                if (open) {
                  setIsPinned(false)
                  setIsEditing(false)
                } else {
                  setIsPinned(true)
                }
              }}
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 pointer-coarse:flex dark:text-zinc-300 dark:hover:bg-white/10"
            >
              <ChevronDownIcon className={`h-4 w-4 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
            </button>
          )}

          {!trade.syncState && !isDeleteConfirmationOpen && (
            <button
              type="button"
              title="Delete trade"
              aria-label={`Delete ${trade.symbol} trade`}
              onClick={(event) => {
                event.stopPropagation()
                setIsDeleteConfirmationOpen(true)
              }}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 group-hover/chip:opacity-100 dark:text-zinc-400 dark:hover:text-rose-400"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* the confirmation covers the row itself, so nothing around it moves */}
        {isDeleteConfirmationOpen && (
          <div
            role="alertdialog"
            aria-label={`Delete ${trade.symbol} trade?`}
            aria-busy={isDeleting}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Escape' && !isDeleting) setIsDeleteConfirmationOpen(false)
            }}
            className="absolute inset-0 flex items-center justify-between gap-3 rounded-[inherit] bg-rose-50 px-3 dark:bg-[#2a1b1e]"
          >
            <span role={deleteError ? 'alert' : 'status'} className="min-w-0 truncate text-[13px] font-medium text-rose-800 dark:text-rose-300">
              {deleteError || (isDeleting ? 'Deleting...' : `Delete ${trade.symbol} trade?`)}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                autoFocus
                disabled={isDeleting}
                onClick={() => setIsDeleteConfirmationOpen(false)}
                className="h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-black/[0.06] disabled:cursor-default disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="inline-flex h-7 min-w-[56px] shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-md bg-rose-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-default disabled:opacity-70 dark:bg-rose-500 dark:hover:bg-rose-600"
              >
                {isDeleting ? <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border border-white/50 border-t-white" /> : deleteError ? 'Retry' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </article>

      {isFailed && (
        <div
          role="alert"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          className="mx-3 mb-2 flex items-center justify-between gap-3 rounded-lg bg-rose-500/[0.08] px-3 py-2"
        >
          <p className="min-w-0 text-xs font-medium text-rose-800 dark:text-rose-300">{trade.syncError || 'Could not save this trade.'}</p>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => onDiscard?.(trade.id)} className="rounded px-2 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-black/[0.05] hover:text-zinc-800 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-100">
              {isNewTrade ? 'Discard' : 'Undo changes'}
            </button>
            <button type="button" onClick={() => onRetry?.(trade.id)} className="rounded bg-rose-600 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600">Retry</button>
          </div>
        </div>
      )}

      {/* the chosen details (max 3): grows out of the row's bottom edge and floats over the rows below it */}
      {hasDetails && !trade.syncState && (
        <div
          className={`absolute inset-x-0 top-full -mt-px rounded-b-xl border border-t-0 border-zinc-300 bg-white px-4 pb-3.5 pt-3 shadow-card-hover transition duration-150 dark:border-zinc-700 dark:bg-panel-hi dark:shadow-none ${
            open
              ? 'opacity-100'
              : 'pointer-events-none -translate-y-0.5 opacity-0 group-hover/chip:pointer-events-auto group-hover/chip:translate-y-0 group-hover/chip:opacity-100 group-has-[:focus-visible]/chip:pointer-events-auto group-has-[:focus-visible]/chip:translate-y-0 group-has-[:focus-visible]/chip:opacity-100'
          }`}
        >
          {isEditing ? (
            <TradeCardFieldEditor
              selected={fieldIds}
              onChange={onFieldsChange}
              choices={fieldChoices}
              defaultSelected={DEFAULT_CARD_FIELDS}
              onDone={finishEditing}
            />
          ) : (
            <div className="flex items-start gap-2">
              {details.length > 0 ? (
                <dl className="grid min-w-0 flex-1 grid-cols-3 gap-x-4 gap-y-3">
                  {details.map((detail) => (
                    <Detail key={detail.id} label={detail.label} value={detail.text} tone={detail.tone} wide={detail.wide} empty={detail.empty} />
                  ))}
                </dl>
              ) : (
                <p className="min-w-0 flex-1 py-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {detailFields.length ? 'Nothing to show for the chosen details on this trade.' : 'No details chosen. Use the pencil to pick up to 3.'}
                </p>
              )}
              {onFieldsChange && (
                <button
                  ref={pencilRef}
                  type="button"
                  title="Edit details"
                  aria-label="Edit the details shown on trades"
                  onClick={() => setIsEditing(true)}
                  className="-mr-1.5 -mt-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100 dark:focus-visible:ring-sky-400"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** The trades as a borderless table: a column header, then one row per trade with a hairline between rows. */
function TradeTable({ trades, ...rowProps }) {
  return (
    <div role="list" aria-label="Trades">
      <div aria-hidden="true" className={`${COLUMNS} hidden items-center gap-x-4 border-b border-zinc-900/[0.09] px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-600 md:grid dark:border-white/[0.08] dark:text-zinc-400`}>
        <span>Asset</span>
        <span>Status</span>
        <span>Date</span>
        <span className="text-right">Size</span>
        <span className="text-right">Result</span>
        <span />
      </div>
      {trades.map((trade) => (
        <TradeRow key={trade.id} trade={trade} {...rowProps} />
      ))}
    </div>
  )
}

export default TradeTable
