/** Dropdown under the asset-name box. Keyboard handling lives in TradeForm; options use mousedown so the input keeps focus. */
function SymbolSuggestions({ id, items, activeIndex, onPick }) {
  if (items.length === 0) return null

  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Matching symbols"
      className="absolute left-0 top-full z-30 mt-1 max-h-72 w-full max-w-md overflow-y-auto rounded-lg border border-zinc-300 bg-white p-1 shadow-lg dark:border-white/[0.14] dark:bg-panel-hi"
    >
      {items.map((item, index) => (
        <li
          key={`${item.symbol}-${item.exchange}`}
          id={`${id}-${index}`}
          role="option"
          aria-selected={index === activeIndex}
          onMouseDown={(event) => {
            event.preventDefault()
            onPick(item)
          }}
          className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left ${
            index === activeIndex ? 'bg-zinc-100 dark:bg-white/[0.08]' : 'hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
          }`}
        >
          <span className="w-28 shrink-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.display}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-zinc-600 dark:text-zinc-400">{item.name}</span>
          {item.exchange && <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">{item.exchange}</span>}
        </li>
      ))}
    </ul>
  )
}

export default SymbolSuggestions
