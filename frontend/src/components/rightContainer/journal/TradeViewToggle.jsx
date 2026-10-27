const TableIcon = ({ className = 'h-3.5 w-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

const CardsIcon = ({ className = 'h-3.5 w-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
)

const OPTIONS = [
  { id: 'table', label: 'Table view', Icon: TableIcon },
  { id: 'cards', label: 'Card view', Icon: CardsIcon }
]

/** Switches the Trades tab between the table (default) and the cards. */
function TradeViewToggle({ value, onChange }) {
  return (
    <div
      role="group"
      aria-label="Trade layout"
      className="inline-flex h-8 items-center rounded-lg border border-zinc-300 bg-white p-0.5 shadow-sm dark:border-white/[0.14] dark:bg-panel dark:shadow-none"
    >
      {OPTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={`flex h-full w-7 cursor-pointer items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 ${
            value === id
              ? 'bg-zinc-900 text-white dark:bg-white/10 dark:text-zinc-100'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100'
          }`}
        >
          <Icon />
        </button>
      ))}
    </div>
  )
}

export default TradeViewToggle
