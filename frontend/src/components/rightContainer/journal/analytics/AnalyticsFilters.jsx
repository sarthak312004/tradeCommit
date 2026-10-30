import { UNTAGGED } from '../../../../utils/tradeBreakdowns'

const selectClass =
  'w-full min-w-0 cursor-pointer rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-800 outline-none transition focus:border-sky-500 dark:border-white/[0.12] dark:bg-panel dark:text-zinc-100'

function FilterSelect({ label, value, onChange, options, allLabel, withNone }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] text-zinc-600 dark:text-zinc-400">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        <option value="">{allLabel}</option>
        {withNone && <option value={UNTAGGED}>None</option>}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

/** Instrument / strategy / setup filters. They apply to every tab. Date range and journal come from the journal header. */
function AnalyticsFilters({ filters, onChange, options, hasStrategy, hasSetup }) {
  const active = Boolean(filters.instrument || filters.strategy || filters.setup)
  const set = (key) => (value) => onChange({ ...filters, [key]: value })
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
        <FilterSelect label="Instrument" value={filters.instrument} onChange={set('instrument')} options={options.instruments} allLabel="All instruments" />
        {hasStrategy && <FilterSelect label="Strategy" value={filters.strategy} onChange={set('strategy')} options={options.strategies} allLabel="All strategies" withNone />}
        {hasSetup && <FilterSelect label="Setup" value={filters.setup} onChange={set('setup')} options={options.setups} allLabel="All setups" withNone />}
      </div>
      {active && (
        <button
          type="button"
          onClick={() => onChange({ instrument: '', strategy: '', setup: '' })}
          className="cursor-pointer pb-1.5 text-xs font-medium text-sky-800 underline-offset-2 transition hover:underline dark:text-sky-300"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

export default AnalyticsFilters
