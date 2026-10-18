import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon, EyeIcon } from '../../../utils/Icons.jsx'
import { controlNeutral } from '../../common/controlStyles'
import { BUILT_IN_FIELDS, DEFAULT_CARD_FIELDS } from '../../../utils/tradeCardFields'

const GROUP_ORDER = ['Trade', 'Result', 'More', 'Your properties']

/**
 * "Hover details" menu above the trade list: tick what a trade chip shows when you hover it.
 *
 * @param {string[]} selected       ids of the ticked details
 * @param {Function} onChange       called with the new list of ids
 * @param {Array}    customOptions  the journal's own properties: [{ id, label }]
 */
function TradeCardSettings({ selected, onChange, customOptions = [] }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const buttonRef = useRef(null)

  const groups = useMemo(() => {
    const all = [...BUILT_IN_FIELDS, ...customOptions.map((option) => ({ ...option, group: 'Your properties' }))]
    return GROUP_ORDER.map((name) => ({ name, items: all.filter((item) => item.group === name) })).filter((group) => group.items.length)
  }, [customOptions])

  const chosen = new Set(selected)
  const visibleCount = groups.reduce((total, group) => total + group.items.filter((item) => chosen.has(item.id)).length, 0)
  const isDefault = selected.length === DEFAULT_CARD_FIELDS.length && DEFAULT_CARD_FIELDS.every((id) => chosen.has(id))

  // close on outside click or Escape (Escape hands focus back to the button)
  useEffect(() => {
    if (!isOpen) return undefined
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const toggle = (id) => {
    onChange(chosen.has(id) ? selected.filter((item) => item !== id) : [...selected, id])
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="Choose what shows when you hover a trade"
        className={controlNeutral}
      >
        <EyeIcon className="h-3.5 w-3.5" />
        Hover details
        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] tabular-nums text-zinc-700 dark:bg-white/[0.08] dark:text-zinc-300">{visibleCount}</span>
        <ChevronDownIcon className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-150 dark:text-zinc-400 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Choose hover details"
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-zinc-300 bg-white shadow-xl motion-safe:animate-[fadeIn_120ms_ease-out] dark:border-white/[0.14] dark:bg-panel-hi"
        >
          <div className="border-b border-zinc-200 px-3.5 py-2.5 dark:border-white/[0.08]">
            <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">Hover details</p>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">Shown under a trade when you hover it. On touch screens, tap its arrow.</p>
          </div>

          <div className="subtle-scrollbar max-h-72 overflow-y-auto p-1.5">
            {groups.map((group) => (
              <fieldset key={group.name} className="min-w-0 px-1 pb-1">
                <legend className="px-1.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">{group.name}</legend>
                {group.items.map((item) => {
                  const checked = chosen.has(item.id)
                  return (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[13px] text-zinc-800 transition-colors hover:bg-zinc-100 has-[:focus-visible]:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/[0.06] dark:has-[:focus-visible]:bg-white/[0.06]"
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} className="sr-only" />
                      <span
                        aria-hidden="true"
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          checked
                            ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                            : 'border-zinc-400 dark:border-white/30'
                        }`}
                      >
                        {checked && <CheckIcon className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 truncate">{item.label}</span>
                    </label>
                  )
                })}
              </fieldset>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-zinc-200 px-3.5 py-2 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={selected.length === 0}
              className="rounded-md px-1.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-default disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
            >
              Hide all
            </button>
            <button
              type="button"
              onClick={() => onChange(DEFAULT_CARD_FIELDS)}
              disabled={isDefault}
              className="rounded-md px-1.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-default disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TradeCardSettings
