import { ChevronDownIcon } from '../../../../utils/Icons.jsx'
import { selectClass } from './importStyles'

function ImportJournalSelect({ journals, value, onChange, ariaLabel, disabled = false, className = '' }) {
  return (
    <span className={`relative inline-flex min-w-0 ${className}`}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        disabled={disabled}
        className={`${selectClass} w-full appearance-none pr-8`}
      >
        {journals.map((journal) => (
          <option key={journal.id} value={journal.id}>
            {journal.name}{journal.mode === 'backtest' ? ' (backtest)' : ''}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
    </span>
  )
}

export default ImportJournalSelect
