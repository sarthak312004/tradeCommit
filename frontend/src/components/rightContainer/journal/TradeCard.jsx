import { useState } from 'react'
import { TrashIcon } from '../../../utils/Icons.jsx'

const sideChip = {
  long: 'bg-emerald-500/[0.14] text-emerald-800 dark:text-emerald-300',
  short: 'bg-rose-500/[0.14] text-rose-800 dark:text-rose-300'
}

function Metric({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-medium tabular-nums text-zinc-700 dark:text-zinc-200">{value}</p>
    </div>
  )
}

function TradeCard({ trade, onSelect, onDelete, onRetry, onDiscard }) {
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const side = String(trade.side ?? trade.direction ?? '').toLowerCase()
  const direction = side === 'long' ? 'Long' : side === 'short' ? 'Short' : 'Unspecified'
  const isOpen = String(trade.status ?? '').toLowerCase() === 'open' || trade.exit == null || trade.exit === ''
  // set while the trade is being saved in the background (or when that failed); see journalContextProvider
  const isSaving = trade.syncState === 'saving'
  const isFailed = trade.syncState === 'failed'
  const isNewTrade = String(trade.id).startsWith('pending-')

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

  return (
    <article
      role="button"
      tabIndex="0"
      onClick={() => onSelect(trade)}
      onKeyDown={handleCardKeyDown}
      aria-busy={isSaving}
      className="group relative cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 py-3.5 text-left shadow-card transition-[box-shadow,border-color,background-color] hover:border-zinc-400/70 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 dark:border-white/[0.12] dark:bg-panel dark:shadow-none dark:hover:border-white/[0.16] dark:hover:bg-panel-hi dark:hover:shadow-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{trade.symbol}</p>
        </div>

        <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${sideChip[side] ?? 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300'}`}>
          {direction}
        </span>
      </div>

      <div className="mt-1 flex h-6 items-center justify-between">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${isOpen ? 'bg-amber-400' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
          <span className="truncate">
            {trade.status}
            <span aria-hidden="true" className="mx-1.5">&middot;</span>
            {trade.date}
          </span>
        </p>

        {isSaving && (
          <span role="status" className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
            Saving...
          </span>
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
            className="-mr-1.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-zinc-500 opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 group-hover:opacity-100 dark:text-zinc-400 dark:hover:text-rose-400"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        )}

        {/* confirmation sits in this row, in the space next to the trash icon, so the card never grows */}
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
            className="-mr-1.5 flex h-6 shrink-0 items-center gap-0.5 rounded-md bg-rose-500/[0.08] pl-2 pr-0.5"
          >
            <span role={deleteError ? 'alert' : 'status'} title={deleteError || undefined} className="mr-1 whitespace-nowrap text-[11px] font-medium text-rose-700 dark:text-rose-300">
              {deleteError ? 'Failed' : isDeleting ? 'Deleting...' : 'Delete?'}
              {deleteError && <span className="sr-only">: {deleteError}</span>}
            </span>
            <button
              type="button"
              autoFocus
              disabled={isDeleting}
              onClick={() => setIsDeleteConfirmationOpen(false)}
              className="h-5 cursor-pointer rounded px-1.5 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-black/[0.06] hover:text-zinc-800 disabled:cursor-default disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="inline-flex h-5 min-w-[46px] shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded bg-rose-600 px-2 text-[11px] font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-default disabled:opacity-70 dark:bg-rose-500 dark:hover:bg-rose-600"
            >
              {isDeleting ? <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border border-white/50 border-t-white" /> : deleteError ? 'Retry' : 'Delete'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-zinc-300 pt-3 dark:border-white/[0.09]">
        <Metric label="Qty" value={trade.qty} />
        <Metric label="Entry" value={trade.entry || '-'} />
        <Metric label="Exit" value={trade.exit || '-'} />
      </div>

      {isFailed && (
        <div
          role="alert"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          className="mt-3 flex items-center justify-between gap-3 rounded-md bg-rose-500/[0.07] px-3 py-2"
        >
          <p className="min-w-0 text-xs font-medium text-rose-700 dark:text-rose-300">{trade.syncError || 'Could not save this trade.'}</p>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => onDiscard?.(trade.id)} className="rounded px-2 py-1 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-black/[0.05] hover:text-zinc-800 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-100">
              {isNewTrade ? 'Discard' : 'Undo changes'}
            </button>
            <button type="button" onClick={() => onRetry?.(trade.id)} className="rounded bg-rose-600 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600">Retry</button>
          </div>
        </div>
      )}
    </article>
  )
}

export default TradeCard
