import { useRef, useState } from 'react'
import { IMPORT_EXTENSIONS, importTemplateUrl } from '../../../../services/importApi'
import { textLink } from './importStyles'
import { SheetIcon, UploadIcon } from './importIcons.jsx'

const HINTS = [
  { title: 'One row per trade', body: 'Date, Symbol, Direction, Quantity, Entry Price and optionally Exit Price, Stop Loss, Exit Date.' },
  { title: 'Broker tradebook', body: 'Buy and Sell fills are matched first-in-first-out into trades. Leftovers stay open.' },
  { title: 'Different column names?', body: 'We’ll try to match them. If we can’t, choose which columns contain your dates, symbols, quantities and prices.' }
]

/** Step 1: drop or choose a CSV / Excel file. The file is only read here; nothing is saved yet. */
function ImportDropzone({ onFile, isReading, error }) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  const pick = (file) => {
    if (file) onFile(file)
    if (inputRef.current) inputRef.current.value = '' // so choosing the same file again still fires
  }

  return (
    <div className="space-y-5">
      <label
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          if (!isReading) pick(event.dataTransfer.files?.[0])
        }}
        className={`flex min-h-[210px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-600 dark:has-[:focus-visible]:ring-sky-400 ${
          isDragging
            ? 'border-sky-600 bg-sky-600/[0.06] dark:border-sky-400 dark:bg-sky-400/[0.08]'
            : 'border-zinc-300 bg-zinc-50/60 hover:bg-zinc-50 dark:border-white/[0.16] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]'
        } ${isReading ? 'pointer-events-none opacity-70' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={`${IMPORT_EXTENSIONS.join(',')},text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`}
          className="sr-only"
          disabled={isReading}
          onChange={(event) => pick(event.target.files?.[0])}
        />
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 shadow-sm dark:border-white/[0.14] dark:bg-panel dark:text-zinc-200 dark:shadow-none">
          {isReading ? (
            <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border border-current/40 border-t-current" />
          ) : (
            <UploadIcon className="h-4 w-4" />
          )}
        </span>
        <span>
          <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {isReading ? 'Reading your file…' : 'Drop a CSV or Excel file here'}
          </span>
          <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">
            {isReading ? 'This only takes a moment.' : <>or <span className="font-medium text-sky-800 underline-offset-2 hover:underline dark:text-sky-300">browse your files</span> · .csv, .xlsx · up to 5 MB</>}
          </span>
        </span>
      </label>

      <p role="alert" className="min-h-4 text-xs text-rose-600 dark:text-rose-400">{error}</p>

      <ul className="grid gap-2 sm:grid-cols-3">
        {HINTS.map((hint) => (
          <li key={hint.title} className="rounded-lg border border-zinc-200 p-3 dark:border-white/[0.10]">
            <p className="text-[13px] font-medium text-zinc-800 dark:text-zinc-100">{hint.title}</p>
            <p className="mt-1 text-xs leading-snug text-zinc-600 dark:text-zinc-400">{hint.body}</p>
          </li>
        ))}
      </ul>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        <SheetIcon className="h-3.5 w-3.5" />
        Not sure of the layout?
        <a href={importTemplateUrl('csv')} download className={textLink}>Download CSV template</a>
        <a href={importTemplateUrl('xlsx')} download className={textLink}>Excel template</a>
      </p>
    </div>
  )
}

export default ImportDropzone
