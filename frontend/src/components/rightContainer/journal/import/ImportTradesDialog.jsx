import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, CloseIcon } from '../../../../utils/Icons.jsx'
import { ghostFooterButton, iconButtonClass } from '../../../common/formStyles'
import { IMPORT_EXTENSIONS, MAX_IMPORT_BYTES, previewTradeImport } from '../../../../services/importApi'
import ImportDropzone from './ImportDropzone'
import ImportReview from './ImportReview'
import ImportColumnMapping from './ImportColumnMapping'
import { KIND_ORDER, primaryButton } from './importStyles'
import { UploadIcon } from './importIcons.jsx'

const networkText = "Can't reach the server. Check your connection and try again."
const messageOf = (error, fallback) => (error instanceof TypeError ? networkText : error?.message || fallback)
const mappingFor = (info) => {
  const candidate = info?.candidates?.find((item) => item.index === info.headerIndex)
  return candidate ? { headerIndex: candidate.index, columns: candidate.mapping } : { headerIndex: -1, columns: {} }
}

/**
 * Import selected trades from a CSV / Excel file into one journal.
 *  1. choose a file (read by the server, nothing saved)
 *  2. review every trade with its intraday / delivery tag, select, pick journals
 *  3. confirm: the selected trades are saved
 * Rendered in a portal because the page header uses backdrop-blur, which would trap `fixed` children.
 *
 * @param {{id: string, name: string, mode?: string}[]} journals  journals that can receive trades
 * @param {string} currentJournalId  the journal the person is looking at (the default destination)
 * @param {(groups: {journalId: string, trades: object[]}[]) => Promise<object>} onImport  saves the reviewed trades
 * @param {(journalId: string) => void} onOpenJournal  switches to a journal after importing
 */
function ImportTradesDialog({ journals, currentJournalId, onImport, onOpenJournal, onClose }) {
  const [step, setStep] = useState('upload')
  const [isReading, setIsReading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState(null)
  const [mappingInfo, setMappingInfo] = useState(null)
  const [mapping, setMapping] = useState({ headerIndex: -1, columns: {} })
  const [preview, setPreview] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [kinds, setKinds] = useState({})
  const [filter, setFilter] = useState('all')
  const [defaultJournal, setDefaultJournal] = useState(() => (journals.some((journal) => journal.id === currentJournalId) ? currentJournalId : journals[0]?.id ?? ''))
  const [result, setResult] = useState(null)

  const dialogRef = useRef(null)
  const isBusy = isReading || isImporting
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = isBusy ? () => {} : onClose
  })

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
    const handleKeyDown = (event) => event.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const journalName = useCallback((id) => journals.find((journal) => journal.id === id)?.name ?? 'Journal', [journals])

  /* ---------------------------------------------------------------- step 1 */

  const handleFile = async (file) => {
    const name = file.name.toLowerCase()
    if (!IMPORT_EXTENSIONS.some((extension) => name.endsWith(extension))) {
      setError(name.endsWith('.xls') ? 'Old .xls files are not supported. Save it as .xlsx or .csv and try again.' : 'Choose a .csv or .xlsx file.')
      return
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setError('This file is larger than 5 MB. Split it and import in parts.')
      return
    }

    setIsReading(true)
    setError('')
    try {
      const data = await previewTradeImport(file)
      setFile(file)
      if (data.mappingRequired) {
        const candidate = data.candidates.find((item) => item.index === data.headerIndex)
        if (!candidate) throw new Error('Could not identify a header row. Choose a CSV or Excel file with a header row and trade data.')
        setMappingInfo(data)
        setMapping(mappingFor(data))
        setStep('mapping')
        return
      }
      setPreview(data)
      setSelected(new Set(data.trades.map((trade) => trade.id)))
      setKinds({})
      setFilter('all')
      setMappingInfo(data.mappingInfo ?? null)
      setMapping(mappingFor(data.mappingInfo))
      setStep('review')
    } catch (readError) {
      setError(messageOf(readError, 'This file could not be read.'))
    } finally {
      setIsReading(false)
    }
  }

  const backToUpload = () => {
    setStep('upload')
    setPreview(null)
    setMappingInfo(null)
    setError('')
  }

  const adjustColumns = () => {
    if (!mappingInfo) return
    setMapping(mappingFor(mappingInfo))
    setError('')
    setStep('mapping')
  }

  const handleHeaderChange = (headerIndex) => {
    const candidate = mappingInfo?.candidates.find((item) => item.index === headerIndex)
    setMapping({ headerIndex, columns: candidate?.mapping ?? {} })
    setError('')
  }

  const handleColumnChange = (role, value) => {
    setMapping((current) => ({ ...current, columns: { ...current.columns, [role]: value } }))
    setError('')
  }

  const hasMappedColumns = ['date', 'symbol', 'quantity'].every((role) => mapping.columns[role] !== undefined && mapping.columns[role] !== '') &&
    (mapping.columns.entry !== undefined && mapping.columns.entry !== '' ||
      mapping.columns.price !== undefined && mapping.columns.price !== '')

  const handleMappedPreview = async () => {
    if (!file || !hasMappedColumns || isReading) return
    setIsReading(true)
    setError('')
    try {
      const data = await previewTradeImport(file, mapping)
      if (data.mappingRequired) throw new Error('These columns still need to be mapped. Check the required fields and try again.')
      setPreview(data)
      setSelected(new Set(data.trades.map((trade) => trade.id)))
      setKinds({})
      setFilter('all')
      setMappingInfo(data.mappingInfo ?? mappingInfo)
      setStep('review')
    } catch (readError) {
      setError(messageOf(readError, 'Could not read trades with these columns.'))
    } finally {
      setIsReading(false)
    }
  }

  /* ---------------------------------------------------------------- step 2 */

  // the tag shown is the file's own, unless the person changed it
  const trades = useMemo(() => (preview?.trades ?? []).map((trade) => ({ ...trade, kind: kinds[trade.id] ?? trade.kind })), [preview, kinds])

  const counts = useMemo(() => {
    const next = { all: trades.length, intraday: 0, delivery: 0, unknown: 0 }
    for (const trade of trades) next[trade.kind] += 1
    return next
  }, [trades])

  // If retagging empties the selected category, display all trades without a follow-up state update.
  const activeFilter = filter !== 'all' && counts[filter] === 0 ? 'all' : filter
  const visible = useMemo(() => (activeFilter === 'all' ? trades : trades.filter((trade) => trade.kind === activeFilter)), [trades, activeFilter])

  const toggleRow = useCallback((id) => {
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

  const toggleVisible = (checked) => {
    setSelected((current) => {
      const next = new Set(current)
      for (const trade of visible) {
        if (checked) next.add(trade.id)
        else next.delete(trade.id)
      }
      return next
    })
  }

  // intraday -> delivery -> unclassified -> intraday
  const cycleKind = useCallback((id) => {
    setKinds((current) => {
      const original = preview?.trades.find((trade) => trade.id === id)?.kind ?? 'unknown'
      const now = current[id] ?? original
      return { ...current, [id]: KIND_ORDER[(KIND_ORDER.indexOf(now) + 1) % KIND_ORDER.length] }
    })
  }, [preview])

  const selectedTrades = useMemo(() => trades.filter((trade) => selected.has(trade.id)), [trades, selected])

  /* ---------------------------------------------------------------- step 3 */

  const handleImport = async () => {
    if (selectedTrades.length === 0 || isImporting) return
    setIsImporting(true)
    setError('')

    const importedTrades = selectedTrades.map((trade) => {
      const { symbol, date, exitDate, direction, quantity, entryPrice, exitPrice, stopLoss, kind, notes } = trade
      return { symbol, date, exitDate, direction, quantity, entryPrice, exitPrice, stopLoss, kind, notes }
    })

    try {
      const saved = await onImport([{ journalId: defaultJournal, trades: importedTrades }])
      setResult(saved)
      setStep('done')
    } catch (importError) {
      setError(messageOf(importError, 'Could not import these trades.'))
    } finally {
      setIsImporting(false)
    }
  }

  const subtitle = step === 'review' ? preview?.fileName : step === 'done' ? 'Import complete' : step === 'mapping' ? file?.name : 'From a broker report or a spreadsheet'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && !isBusy && onClose()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Import trades"
        className={`flex max-h-[90vh] w-full flex-col rounded-2xl border border-zinc-300 bg-white shadow-2xl outline-none dark:border-white/[0.14] dark:bg-panel ${step === 'review' ? 'h-[90vh] max-w-4xl' : step === 'mapping' ? 'max-w-2xl' : 'max-w-xl'}`}
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-5">
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-100">Import trades</h3>
            <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isBusy} aria-label="Close" className={`${iconButtonClass} cursor-pointer disabled:opacity-50`}>
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className={`flex min-h-0 flex-1 flex-col px-6 pb-5 pt-3 ${step === 'review' ? '' : 'subtle-scrollbar overflow-y-auto'}`}>
          {step === 'upload' && <ImportDropzone onFile={handleFile} isReading={isReading} error={error} />}

          {step === 'mapping' && mappingInfo && (
            <div className="space-y-3">
              <ImportColumnMapping
                mappingInfo={mappingInfo}
                mapping={mapping}
                onHeaderChange={handleHeaderChange}
                onColumnChange={handleColumnChange}
              />
              {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
            </div>
          )}

          {step === 'review' && preview && (
            <ImportReview
              preview={preview}
              trades={trades}
              kinds={kinds}
              selected={selected}
              filter={activeFilter}
              counts={counts}
              visible={visible}
              journals={journals}
              defaultJournal={defaultJournal}
              onFilter={setFilter}
              onToggle={toggleRow}
              onToggleVisible={toggleVisible}
              onCycleKind={cycleKind}
              onDefaultJournal={setDefaultJournal}
              onChangeFile={backToUpload}
              onChangeMapping={mappingInfo ? adjustColumns : undefined}
            />
          )}

          {step === 'done' && result && (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/[0.14] text-emerald-700 dark:text-emerald-300">
                <CheckIcon className="h-5 w-5" />
              </span>
              <h4 className="mt-4 text-base font-semibold tracking-[-0.02em] text-zinc-900 dark:text-zinc-50">
                {result.imported > 0 ? `${result.imported} ${result.imported === 1 ? 'trade' : 'trades'} imported` : 'Nothing new to import'}
              </h4>
              {result.duplicates > 0 && (
                <p className="mt-1 max-w-sm text-xs text-zinc-600 dark:text-zinc-400">
                  {result.duplicates} {result.duplicates === 1 ? 'trade was' : 'trades were'} already in the journal and {result.duplicates === 1 ? 'was' : 'were'} skipped.
                </p>
              )}

              <ul className="mt-5 w-full max-w-sm divide-y divide-zinc-200 rounded-xl border border-zinc-200 text-left dark:divide-white/[0.08] dark:border-white/[0.10]">
                {result.journals.map((item) => (
                  <li key={item.journalId} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{journalName(item.journalId)}</span>
                      <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                        {item.imported} added{item.duplicates > 0 ? `, ${item.duplicates} already there` : ''}
                      </span>
                    </span>
                    {item.imported > 0 && item.journalId !== currentJournalId && (
                      <button type="button" onClick={() => onOpenJournal(item.journalId)} className="shrink-0 cursor-pointer text-xs font-medium text-sky-800 underline-offset-2 hover:underline dark:text-sky-300">
                        Open
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-zinc-300 px-6 py-3 dark:border-white/[0.12]">
          <div className="min-w-0 text-xs text-zinc-600 dark:text-zinc-400">
            {step === 'review' && (
              error ? (
                <p role="alert" className="text-rose-600 dark:text-rose-400">{error}</p>
              ) : (
                <p aria-live="polite" className="truncate">
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">{selectedTrades.length} of {trades.length} selected</span>
                  {selectedTrades.length > 0 && (
                    <span> · All will go to {journalName(defaultJournal)}</span>
                  )}
                </p>
              )
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {step === 'done' ? (
              <button type="button" onClick={onClose} className={primaryButton}>Done</button>
            ) : (
              <>
                <button type="button" onClick={onClose} disabled={isBusy} className={`${ghostFooterButton} cursor-pointer disabled:opacity-50`}>Cancel</button>
                {step === 'mapping' && (
                  <>
                    <button type="button" onClick={backToUpload} disabled={isBusy} className={`${ghostFooterButton} cursor-pointer disabled:opacity-50`}>Choose another file</button>
                    <button type="button" onClick={handleMappedPreview} disabled={!hasMappedColumns || isReading} className={primaryButton}>
                      {isReading ? 'Reading…' : 'Preview trades'}
                    </button>
                  </>
                )}
                {step === 'review' && (
                  <button type="button" onClick={handleImport} disabled={selectedTrades.length === 0 || isImporting} className={primaryButton}>
                    {isImporting ? (
                      <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border border-current/40 border-t-current" />
                    ) : (
                      <UploadIcon className="h-3.5 w-3.5" />
                    )}
                    {isImporting ? 'Importing…' : `Import ${selectedTrades.length} ${selectedTrades.length === 1 ? 'trade' : 'trades'}`}
                  </button>
                )}
              </>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}

export default ImportTradesDialog
