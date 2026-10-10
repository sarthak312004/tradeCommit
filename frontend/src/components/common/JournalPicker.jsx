import { useEffect, useId, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from '../../utils/Icons.jsx'
import { focusRing } from './controlStyles'

/**
 * Small themed dropdown for choosing a journal (or none).
 * `variant="pill"` is a compact button with a floating menu (planner page).
 * `variant="field"` fills its parent like a form field and opens the list in the flow, so the sidebar's
 * overflow clipping never cuts it off (create-planner form).
 */
function JournalPicker({ journals, value, onChange, disabled = false, variant = 'pill', emptyLabel = 'Not connected', ariaLabel = 'Connected journal' }) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef(null)
  const listId = useId()
  const selected = journals.find((journal) => journal.id === value) ?? null
  const isPill = variant === 'pill'

  // close on outside click
  useEffect(() => {
    if (!isOpen) return undefined
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  // move focus to the chosen row when the menu opens
  useEffect(() => {
    if (!isOpen) return
    const rows = rootRef.current?.querySelectorAll('[role="option"] button')
    const current = rootRef.current?.querySelector('[aria-selected="true"] button')
    ;(current ?? rows?.[0])?.focus({ preventScroll: true })
  }, [isOpen])

  const pick = (id) => {
    setIsOpen(false)
    if (id !== (value ?? '')) onChange(id)
    rootRef.current?.querySelector('[aria-haspopup]')?.focus()
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && isOpen) {
      event.stopPropagation()
      setIsOpen(false)
      rootRef.current?.querySelector('[aria-haspopup]')?.focus()
      return
    }
    if (!isOpen || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return
    event.preventDefault()
    const rows = [...rootRef.current.querySelectorAll('[role="option"] button')]
    const index = rows.indexOf(document.activeElement)
    const next = event.key === 'ArrowDown' ? Math.min(rows.length - 1, index + 1) : Math.max(0, index - 1)
    rows[next]?.focus()
  }

  const triggerClass = isPill
    ? `inline-flex h-8 max-w-[15rem] cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${focusRing} ${
        selected
          ? 'border-sky-700/30 bg-sky-700/10 text-sky-900 hover:bg-sky-700/15 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200 dark:hover:bg-sky-400/15'
          : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-white/[0.14] dark:bg-panel dark:text-zinc-300 dark:hover:bg-white/[0.06]'
      }`
    : `flex h-8 w-full cursor-pointer items-center gap-2 rounded-md border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 shadow-sm transition-colors hover:border-zinc-400 disabled:cursor-wait disabled:opacity-60 dark:border-white/[0.14] dark:bg-panel dark:text-zinc-100 dark:hover:border-white/20 ${focusRing}`

  const menuClass = isPill
    ? 'subtle-scrollbar absolute left-0 top-full z-40 mt-1.5 max-h-64 w-60 overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-white p-1 shadow-lg shadow-zinc-900/10 dark:border-white/[0.12] dark:bg-panel dark:shadow-black/40'
    : 'subtle-scrollbar mt-1.5 max-h-36 overflow-y-auto overscroll-contain rounded-md border border-zinc-300 bg-white p-1 shadow-sm dark:border-white/[0.12] dark:bg-panel'

  const rowClass = (active) =>
    `flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-xs transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.07] ${focusRing} focus-visible:ring-inset ${
      active ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-white/[0.06] dark:text-zinc-50' : 'text-zinc-700 dark:text-zinc-300'
    }`

  const rows = [{ id: '', name: emptyLabel, muted: true }, ...journals.map((journal) => ({ id: journal.id, name: journal.name }))]

  return (
    <div ref={rootRef} onKeyDown={handleKeyDown} className={isPill ? 'relative inline-block' : 'min-w-0'}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-label={`${ariaLabel}: ${selected ? selected.name : emptyLabel}`}
        className={triggerClass}
      >
        {isPill && <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? 'bg-sky-600 dark:bg-sky-400' : 'bg-zinc-400 dark:bg-zinc-500'}`} />}
        <span className={`min-w-0 flex-1 truncate text-left ${!isPill && !selected ? 'text-zinc-500 dark:text-zinc-400' : ''}`}>{selected ? selected.name : emptyLabel}</span>
        <ChevronDownIcon className={`h-3 w-3 shrink-0 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <ul id={listId} role="listbox" aria-label={ariaLabel} className={menuClass}>
          {rows.map((row) => {
            const active = row.id === (value ?? '') || (row.id === '' && !selected)
            return (
              <li key={row.id || 'none'} role="option" aria-selected={active}>
                <button type="button" onClick={() => pick(row.id)} className={rowClass(active)}>
                  <span className={`min-w-0 flex-1 truncate ${row.muted && !active ? 'text-zinc-500 dark:text-zinc-400' : ''}`}>{row.name}</span>
                  {active && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-sky-700 dark:text-sky-300" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default JournalPicker
