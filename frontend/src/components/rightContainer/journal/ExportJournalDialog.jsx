import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon, DownloadIcon } from '../../../utils/Icons.jsx'
import { iconButtonClass, ghostFooterButton } from '../../common/formStyles'
import { EXPORT_RANGES, resolveExportRange } from '../../../utils/exportRange'
import { EXPORT_FORMATS, downloadJournalExport } from '../../../services/exportApi'
import { filterTradesByDate } from '../../../utils/tradeAnalytics'

const FORMAT_KEY = 'tradecommit:export-format'
const readFormat = () => {
  try {
    const saved = window.localStorage.getItem(FORMAT_KEY)
    return EXPORT_FORMATS.some((format) => format.id === saved) ? saved : 'xlsx'
  } catch {
    return 'xlsx'
  }
}

const dateInputClass =
  'h-9 w-full rounded-md border border-zinc-300 bg-transparent px-2.5 text-[13px] text-zinc-800 outline-none transition-colors [color-scheme:light] focus:border-sky-600 focus:ring-2 focus:ring-sky-600/30 dark:border-white/[0.14] dark:text-zinc-100 dark:[color-scheme:dark] dark:focus:border-sky-400 dark:focus:ring-sky-400/30'

const optionClass = (selected) =>
  `cursor-pointer rounded-lg border transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-600 dark:has-[:focus-visible]:ring-sky-400 ${
    selected
      ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-200 dark:bg-white/[0.07]'
      : 'border-zinc-300 hover:bg-zinc-50 dark:border-white/[0.14] dark:hover:bg-white/[0.04]'
  }`

/**
 * Modal for exporting the selected journal: pick a file format and a date range, then download.
 * The file itself is built by the server (GET /api/v1/journals/:id/export).
 * Rendered in a portal because the page header uses backdrop-blur, which would trap `fixed` children.
 */
function ExportJournalDialog({ journal, onClose }) {
  const [format, setFormat] = useState(readFormat)
  const [preset, setPreset] = useState('all')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = isExporting ? () => {} : onClose
  })

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
    const handleKeyDown = (event) => event.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const range = useMemo(() => resolveExportRange(preset, custom), [preset, custom])
  const isCustomIncomplete = preset === 'custom' && !range.from && !range.to
  const isCustomReversed = Boolean(range.from && range.to && range.from > range.to)

  // trades that are still saving (or failed) are not on the server yet, so they are not counted
  const tradeCount = useMemo(() => {
    const saved = (journal.trades ?? []).filter((trade) => !trade.syncState)
    return filterTradesByDate(saved, range).length
  }, [journal.trades, range])

  const canExport = !isExporting && !isCustomIncomplete && !isCustomReversed && tradeCount > 0

  const changeCustom = (field, value) => {
    setCustom((current) => ({ ...current, [field]: value }))
    setPreset('custom')
  }

  const handleExport = async (event) => {
    event.preventDefault()
    if (!canExport) return

    setIsExporting(true)
    setError('')
    try {
      await downloadJournalExport(journal.id, { format, preset, from: range.from, to: range.to })
      try {
        window.localStorage.setItem(FORMAT_KEY, format)
      } catch {
        // storage unavailable: the format just isn't remembered
      }
      onClose()
    } catch (exportError) {
      setError(exportError instanceof TypeError ? "Can't reach the server. Check your connection and try again." : exportError.message || 'Could not export the journal')
      setIsExporting(false)
    }
  }

  const summary = isCustomIncomplete
    ? 'Pick a start and/or end date.'
    : isCustomReversed
      ? 'The start date must be on or before the end date.'
      : tradeCount === 0
        ? 'No trades in this range.'
        : `${tradeCount} ${tradeCount === 1 ? 'trade' : 'trades'} will be exported.`

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && !isExporting && onClose()}
    >
      <form
        ref={dialogRef}
        tabIndex={-1}
        onSubmit={handleExport}
        role="dialog"
        aria-modal="true"
        aria-label="Export journal"
        className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-zinc-300 bg-white shadow-2xl outline-none dark:border-white/[0.14] dark:bg-panel"
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-5">
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-100">Export journal</h3>
            <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400">{journal.name}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isExporting} aria-label="Close" className={`${iconButtonClass} cursor-pointer disabled:opacity-50`}>
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="subtle-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-5 pt-3">
          <fieldset>
            <legend className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">Format</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {EXPORT_FORMATS.map((option) => (
                <label key={option.id} className={`flex items-start gap-2.5 p-2.5 ${optionClass(format === option.id)}`}>
                  <input
                    type="radio"
                    name="export-format"
                    value={option.id}
                    checked={format === option.id}
                    onChange={() => setFormat(option.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-zinc-800 dark:accent-zinc-200"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
                      {option.label}
                      <span className="rounded bg-black/[0.05] px-1.5 font-mono text-[10px] font-normal leading-4 text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300">{option.ext}</span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-zinc-600 dark:text-zinc-400">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">Date range</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {EXPORT_RANGES.map((option) => (
                <label key={option.id} className={`flex items-center justify-center px-2 py-2 text-center text-xs font-medium ${optionClass(preset === option.id)} ${preset === option.id ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  <input type="radio" name="export-range" value={option.id} checked={preset === option.id} onChange={() => setPreset(option.id)} className="sr-only" />
                  {option.label}
                </label>
              ))}
            </div>

            {preset === 'custom' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="min-w-0">
                  <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">From</span>
                  <input type="date" value={custom.from} max={custom.to || undefined} onChange={(event) => changeCustom('from', event.target.value)} className={dateInputClass} />
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">To</span>
                  <input type="date" value={custom.to} min={custom.from || undefined} onChange={(event) => changeCustom('to', event.target.value)} className={dateInputClass} />
                </label>
              </div>
            )}

            <p aria-live="polite" className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
              {range.from || range.to ? `${range.from || 'Start'} to ${range.to || 'today'}. ` : ''}
              {summary}
            </p>
          </fieldset>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-300 px-6 py-3 dark:border-white/[0.12]">
          <p role="alert" className="min-w-0 text-xs text-rose-600 dark:text-rose-400">{error}</p>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} disabled={isExporting} className={`${ghostFooterButton} cursor-pointer disabled:opacity-50`}>Cancel</button>
            <button
              type="submit"
              disabled={!canExport}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-zinc-900 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {isExporting ? (
                <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border border-current/40 border-t-current" />
              ) : (
                <DownloadIcon className="h-3.5 w-3.5" />
              )}
              {isExporting ? 'Preparing...' : 'Export'}
            </button>
          </div>
        </footer>
      </form>
    </div>,
    document.body
  )
}

export default ExportJournalDialog
