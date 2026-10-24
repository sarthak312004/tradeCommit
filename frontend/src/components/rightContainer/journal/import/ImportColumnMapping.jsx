import { selectClass } from './importStyles'

const FIELDS = [
  { id: 'date', label: 'Trade date', required: true },
  { id: 'symbol', label: 'Symbol / instrument', required: true },
  { id: 'quantity', label: 'Quantity', required: true },
  { id: 'entry', label: 'Entry price', required: false },
  { id: 'price', label: 'Execution price (buy/sell rows)', required: false },
  { id: 'side', label: 'Direction or Buy/Sell', required: false },
  { id: 'exit', label: 'Exit price', required: false },
  { id: 'exitDate', label: 'Exit date', required: false },
  { id: 'stop', label: 'Stop loss', required: false },
  { id: 'product', label: 'Product / trade type', required: false },
  { id: 'notes', label: 'Notes', required: false },
  { id: 'time', label: 'Execution time', required: false },
]

function ImportColumnMapping({ mappingInfo, mapping, onHeaderChange, onColumnChange }) {
  const candidate = mappingInfo.candidates.find((item) => item.index === mapping.headerIndex)

  return (
    <section className="subtle-scrollbar max-h-full space-y-4 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-white/[0.10] dark:bg-white/[0.03]">
      <div>
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Match your file columns</h4>
        <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
          We couldn’t reliably match this file’s structure. Choose its header row, or select ‘No header row’ if the file contains only trade data. Then map the columns below; nothing is saved until you review and confirm.
        </p>
      </div>

      <label className="flex max-w-lg flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
        Header row
        <select
          value={mapping.headerIndex}
          onChange={(event) => onHeaderChange(Number(event.target.value))}
          className={`${selectClass} w-full`}
        >
          {mappingInfo.candidates.map((item) => (
            <option key={item.index} value={item.index}>
              {item.index === -1 ? 'No header row — first row is trade data' : `Row ${item.index + 1}: ${item.names.slice(0, 5).join(' · ')}${item.names.length > 5 ? ' …' : ''}`}
            </option>
          ))}
        </select>
      </label>

      {candidate && (
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field.id} className="flex min-w-0 flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              <span>{field.label}{field.required && <span className="text-rose-600 dark:text-rose-400"> *</span>}</span>
              <select
                value={mapping.columns[field.id] ?? ''}
                onChange={(event) => onColumnChange(field.id, event.target.value)}
                className={`${selectClass} w-full`}
              >
                <option value="">Not in file</option>
                {candidate.names.map((name, index) => (
                  <option key={`${index}-${name}`} value={index}>
                    {name} — {candidate.samples.find((sample) => sample[index])?.[index] || 'sample unavailable'}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
        Required: date, symbol, quantity, and one price column. For broker buy/sell fills, map the direction/action column too so fills can be matched into trades.
      </p>
    </section>
  )
}

export default ImportColumnMapping
