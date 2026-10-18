import { useEffect, useMemo, useRef } from 'react'
import { CheckIcon } from '../../../utils/Icons.jsx'
import { MAX_CARD_FIELDS } from '../../../utils/tradeCardFields'

const GROUP_ORDER = ['Trade', 'Result', 'More', 'Your properties']

export function PencilIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

/**
 * Picks which details a trade chip shows. Opens inside the chip's hover panel when the pencil is clicked.
 * At most MAX_CARD_FIELDS can be ticked: once the limit is reached, the other boxes are disabled.
 *
 * @param {string[]} selected       ids of the ticked details, in the order they were picked
 * @param {Function} onChange       called with the new list of ids
 * @param {Array}    choices        every field of the trade form: [{ id, label, group }]
 * @param {string[]} defaultSelected ids the Reset button goes back to
 * @param {Function} onDone         called when the person is finished (Done button or Escape)
 */
function TradeCardFieldEditor({ selected, onChange, choices = [], defaultSelected = [], onDone }) {
  const rootRef = useRef(null)

  const groups = useMemo(() => {
    return GROUP_ORDER.map((name) => ({ name, items: choices.filter((item) => item.group === name) })).filter((group) => group.items.length)
  }, [choices])

  const chosen = new Set(selected)
  const isFull = selected.length >= MAX_CARD_FIELDS
  const isDefault = selected.length === defaultSelected.length && defaultSelected.every((id, index) => selected[index] === id)

  // move focus into the picker when it opens
  useEffect(() => {
    rootRef.current?.querySelector('input:not(:disabled)')?.focus()
  }, [])

  const toggle = (id) => {
    if (chosen.has(id)) onChange(selected.filter((item) => item !== id))
    else if (!isFull) onChange([...selected, id])
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={`Choose up to ${MAX_CARD_FIELDS} details`}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        onDone()
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
          Show up to {MAX_CARD_FIELDS} details
          <span aria-live="polite" className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${isFull ? 'bg-sky-500/15 text-sky-800 dark:text-sky-300' : 'bg-zinc-100 text-zinc-700 dark:bg-white/[0.08] dark:text-zinc-300'}`}>
            {selected.length}/{MAX_CARD_FIELDS}
          </span>
        </p>
        <button
          type="button"
          onClick={onDone}
          className="h-7 cursor-pointer rounded-md bg-zinc-900 px-2.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300 dark:focus-visible:ring-sky-400"
        >
          Done
        </button>
      </div>

      <div className="subtle-scrollbar -mx-1 mt-1 max-h-56 overflow-y-auto px-1">
        {groups.map((group) => (
          <fieldset key={group.name} className="min-w-0 pb-1">
            <legend className="pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">{group.name}</legend>
            <div className="grid grid-cols-1 gap-x-2 sm:grid-cols-2">
              {group.items.map((item) => {
                const checked = chosen.has(item.id)
                const blocked = isFull && !checked
                return (
                  <label
                    key={item.id}
                    title={blocked ? `Untick one to add another (max ${MAX_CARD_FIELDS})` : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[13px] transition-colors has-[:focus-visible]:bg-zinc-100 dark:has-[:focus-visible]:bg-white/[0.06] ${
                      blocked
                        ? 'cursor-not-allowed text-zinc-400 dark:text-zinc-500'
                        : 'cursor-pointer text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <input type="checkbox" checked={checked} disabled={blocked} onChange={() => toggle(item.id)} className="sr-only" />
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        checked
                          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                          : blocked
                            ? 'border-zinc-300 dark:border-white/15'
                            : 'border-zinc-400 dark:border-white/30'
                      }`}
                    >
                      {checked && <CheckIcon className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 truncate">{item.label}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-1 flex items-center gap-1 border-t border-zinc-200 pt-2 dark:border-white/[0.08]">
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={selected.length === 0}
          className="rounded-md px-1.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-default disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => onChange(defaultSelected)}
          disabled={isDefault}
          className="rounded-md px-1.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-default disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

export default TradeCardFieldEditor
