import { useEffect, useRef, useState } from "react"
import { CURRENCY_OPTIONS, currencyName } from "../../utils/currencies"
import { focusRing } from "./sidebarStyles"

/**
 * Compact currency picker with a scrollable list of codes and names.
 * The list renders in the flow, so the sidebar's overflow clipping never cuts it off.
 */
function CurrencyPicker({ value, onChange, onEscape }) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedRef = useRef(null)

  useEffect(() => {
    if (isOpen) selectedRef.current?.scrollIntoView({ block: "nearest" })
  }, [isOpen])

  const handleKeyDown = (event) => {
    if (event.key !== "Escape") return
    if (isOpen) {
      event.stopPropagation()
      setIsOpen(false)
    } else {
      onEscape?.()
    }
  }

  const pick = (code) => {
    onChange(code)
    setIsOpen(false)
  }

  return (
    <div onKeyDown={handleKeyDown} className="min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={currencyName(value)}
        className={`flex h-8 w-full cursor-pointer items-center gap-2 rounded-md border border-zinc-300 bg-white px-2.5 text-[11px] transition-colors hover:border-zinc-300 focus-visible:ring-2 dark:border-white/[0.14] dark:bg-panel dark:hover:border-white/20 ${focusRing}`}
      >
          <span className="shrink-0 font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">{value}</span>
          <span className="min-w-0 flex-1 truncate text-left text-[10px] text-zinc-600 dark:text-zinc-300">{currencyName(value)}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-3 w-3 text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label="Currency"
          className="subtle-scrollbar mt-1.5 max-h-36 overflow-y-auto overscroll-contain rounded-md border border-zinc-300 bg-white p-1 shadow-sm dark:border-white/[0.12] dark:bg-panel"
        >
          {CURRENCY_OPTIONS.map(({ code }) => {
            const selected = code === value
            return (
              <li key={code} role="option" aria-selected={selected} ref={selected ? selectedRef : null}>
                <button
                  type="button"
                  onClick={() => pick(code)}
                  className={`flex h-7 w-full cursor-pointer items-center gap-2.5 rounded px-2.5 text-left text-[10px] transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.07] ${focusRing} focus-visible:ring-inset ${
                    selected ? "bg-zinc-100 dark:bg-white/[0.06]" : ""
                  }`}
                >
                  <span className={`w-8 shrink-0 font-semibold tabular-nums ${selected ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"}`}>{code}</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">{currencyName(code)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default CurrencyPicker
