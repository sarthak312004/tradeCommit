import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon, TrashIcon } from '../../../utils/Icons.jsx'
import { DEFAULT_CURRENCY } from '../../../utils/currencies'
import { formatDateKey, formatMoney, formatR, getTradePnl, getTradeR, toDateKey, toneOf } from '../../../utils/tradeAnalytics'
import { DEFAULT_CARD_FIELDS, formatSignedPercent, getTradeReturn } from '../../../utils/tradeCardFields'
import TradeCardFieldEditor, { PencilIcon } from './TradeCardFieldEditor'

const sideChip = {
  long: 'bg-emerald-500/[0.14] text-emerald-800 dark:text-emerald-300',
  short: 'bg-rose-500/[0.14] text-rose-800 dark:text-rose-300'
}

// text colours for results (all AA on white and on the dark panel)
const toneText = {
  positive: 'text-emerald-700 dark:text-emerald-400',
  negative: 'text-rose-700 dark:text-rose-400',
  neutral: 'text-zinc-900 dark:text-zinc-50'
}

// muted label (zinc-600 / zinc-400, AA) over a value (zinc-900 / zinc-50, AAA)
function Detail({ label, value, tone = 'neutral', wide = false }) {
  return (
    <div className={`min-w-0 ${wide ? 'col-span-full' : ''}`}>
      <dt className="text-[11px] font-medium uppercase leading-4 tracking-wide text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd
        className={`mt-0.5 text-[13px] font-semibold leading-5 tabular-nums ${toneText[tone] ?? toneText.neutral} ${wide ? 'line-clamp-2 break-words font-medium' : 'truncate'}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * A trade as a chip: asset, direction, status and date on the left, the result on the right.
 * Hovering it (or focusing it with the keyboard, or tapping its arrow on touch screens) opens a panel
 * under it with up to 3 chosen details. A small pencil in that panel lets the person change which ones, from every
 * field of the trade form; the choice is shared by all chips, and a trade with no value for a field simply leaves it out.
 * The panel floats over what follows, so the list never jumps around while the pointer moves over it.
 */
function TradeCard({ trade, currency = DEFAULT_CURRENCY, detailFields = [], fieldIds = [], fieldChoices = [], onFieldsChange, onSelect, onDelete, onRetry, onDiscard }) {
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isPinned, setIsPinned] = useState(false) // opened with the arrow (touch screens)
  const [isEditing, setIsEditing] = useState(false) // picking which details to show (keeps the panel open)
  const wrapperRef = useRef(null)
  const pencilRef = useRef(null)
  const side = String(trade.side ?? trade.direction ?? '').toLowerCase()
  const direction = side === 'long' ? 'Long' : side === 'short' ? 'Short' : 'Unspecified'
  const isOpen = String(trade.status ?? '').toLowerCase() === 'open' || trade.exit == null || trade.exit === ''
  // set while the trade is being saved in the background (or when that failed); see journalContextProvider
  const isSaving = trade.syncState === 'saving'
  const isFailed = trade.syncState === 'failed'
  const isNewTrade = String(trade.id).startsWith('pending-')

  const pnl = getTradePnl(trade)
  const pnlTone = toneOf(pnl)
  const secondary = [getTradeR(trade) !== null ? formatR(getTradeR(trade)) : null, getTradeReturn(trade) !== null ? formatSignedPercent(getTradeReturn(trade)) : null].filter(Boolean)
  const dateText = formatDateKey(toDateKey(trade.date), { withYear: false }) || trade.date

  // the chosen details, read from this trade
  const details = useMemo(
    () => detailFields
      .map((field) => {
        const detail = field.get(trade, currency)
        return detail ? { id: field.id, label: field.label, wide: field.wide, ...detail } : null
      })
      .filter(Boolean),
    [detailFields, trade, currency]
  )
  // the panel is there even with nothing chosen, so the pencil is always reachable
  const hasDetails = !isDeleteConfirmationOpen

  // while picking, a click outside the chip ends it
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

  const handleCardKeyDown = (event) => {
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

  return (
    <div ref={wrapperRef} className={`group/chip relative hover:z-20 has-[:focus-visible]:z-20 ${open ? 'z-20' : ''}`}>
      <article
        role="button"
        tabIndex="0"
        onClick={() => onSelect(trade)}
        onKeyDown={handleCardKeyDown}
        aria-busy={isSaving}
        className={`tc-surface tc-trade-card relative flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-card transition-[box-shadow,border-color,background-color,border-radius] hover:border-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas dark:border-zinc-800 dark:bg-panel dark:shadow-none dark:hover:border-zinc-700 dark:hover:bg-panel-hi dark:focus-visible:ring-sky-400 dark:focus-visible:ring-offset-night ${
          hasDetails ? 'group-hover/chip:rounded-b-none group-has-[:focus-visible]/chip:rounded-b-none' : ''
        } ${open ? 'rounded-b-none border-zinc-300 dark:border-zinc-700 dark:bg-panel-hi' : ''}`}
      >
        {/* left: what was traded */}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{trade.symbol}</p>
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${sideChip[side] ?? 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300'}`}>
              {direction}
            </span>
          </div>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${isOpen ? 'bg-amber-500 dark:bg-amber-400' : 'bg-zinc-400 dark:bg-zinc-500'}`} />
            <span className="truncate">
              {trade.status}
              <span aria-hidden="true" className="mx-1.5">&middot;</span>
              {dateText}
            </span>
          </p>
        </div>

        {/* right: the result, then the small actions */}
        <div className="flex shrink-0 items-center gap-1">
          <div className="min-w-0 text-right">
            {isSaving ? (
              <span role="status" className="flex items-center justify-end gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
                Saving...
              </span>
            ) : (
              <>
                <p className={`text-[15px] font-semibold leading-5 tabular-nums ${pnl === null ? 'text-zinc-500 dark:text-zinc-400' : toneText[pnlTone]}`}>
                  {pnl === null ? '-' : formatMoney(pnl, { signed: true, currency })}
                </p>
                <p className="mt-1 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                  {secondary.length ? secondary.join(' \u00b7 ') : isOpen ? 'No exit yet' : '\u00a0'}
                </p>
              </>
            )}
          </div>

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
              className="-mr-1.5 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 group-hover/chip:opacity-100 dark:text-zinc-400 dark:hover:text-rose-400"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* the confirmation covers the chip itself, so nothing around it moves */}
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
            className="absolute inset-0 flex items-center justify-between gap-3 rounded-[inherit] bg-rose-50 px-4 dark:bg-[#2a1b1e]"
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
          className="mt-1.5 flex items-center justify-between gap-3 rounded-lg bg-rose-500/[0.08] px-3 py-2"
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

      {/* the chosen details (max 3): grows out of the chip's bottom edge and floats over the chips below it */}
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
                    <Detail key={detail.id} label={detail.label} value={detail.text} tone={detail.tone} wide={detail.wide} />
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

export default TradeCard
