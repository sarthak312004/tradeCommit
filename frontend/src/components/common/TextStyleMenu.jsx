import { useEffect, useId, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from '../../utils/Icons.jsx'
import { focusRing } from './controlStyles'

const OPTIONS = [
  { value: 'p', label: 'Text', preview: 'text-[13px]' },
  { value: 'h2', label: 'Headline', preview: 'text-base font-semibold' },
  { value: 'h3', label: 'Subheadline', preview: 'text-[15px] font-semibold' },
  { value: 'h4', label: 'Small heading', preview: 'text-[13px] font-semibold' }
]

// keep the text selection inside the editor while the menu is used
const keepSelection = (event) => event.preventDefault()

/**
 * Themed "Text style" dropdown for the rich text toolbars (replaces the browser's plain select).
 * `value` is the current block ('p', 'h2', 'h3', 'h4'; anything else shows as Text); `onChange(tag)` applies it.
 * Mouse use never takes focus away from the editor, so the selection is kept; keyboard users get arrow-key navigation.
 */
function TextStyleMenu({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusRows, setFocusRows] = useState(false)
  const rootRef = useRef(null)
  const listId = useId()
  const current = OPTIONS.find((option) => option.value === value) ?? OPTIONS[0]

  useEffect(() => {
    if (!isOpen) return undefined
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  // only keyboard users move focus into the list
  useEffect(() => {
    if (isOpen && focusRows) rootRef.current?.querySelector('[aria-selected="true"] button')?.focus({ preventScroll: true })
  }, [isOpen, focusRows])

  const close = () => {
    setIsOpen(false)
    setFocusRows(false)
  }

  const handleTriggerClick = (event) => {
    setFocusRows(event.detail === 0) // detail 0 = opened with Enter / Space
    setIsOpen((open) => !open)
  }

  const pick = (tag) => {
    close()
    onChange(tag)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && isOpen) {
      event.stopPropagation()
      close()
      rootRef.current?.querySelector('[aria-haspopup]')?.focus()
      return
    }
    if (!isOpen || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return
    event.preventDefault()
    const rows = [...rootRef.current.querySelectorAll('[role="option"] button')]
    const index = rows.indexOf(document.activeElement)
    rows[event.key === 'ArrowDown' ? Math.min(rows.length - 1, index + 1) : Math.max(0, index - 1)]?.focus()
  }

  return (
    <div ref={rootRef} onKeyDown={handleKeyDown} className="relative">
      <button
        type="button"
        title="Text style"
        aria-label={`Text style: ${current.label}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        onMouseDown={keepSelection}
        onClick={handleTriggerClick}
        className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-50 ${focusRing} ${isOpen ? 'bg-zinc-200/70 dark:bg-white/10' : ''}`}
      >
        <span className="min-w-[3.25rem] text-left">{current.label}</span>
        <ChevronDownIcon className={`h-3 w-3 shrink-0 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Text style"
          className="absolute left-0 top-full z-30 mt-1.5 w-48 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg shadow-zinc-900/10 dark:border-white/[0.12] dark:bg-panel dark:shadow-black/40"
        >
          {OPTIONS.map((option) => {
            const active = option.value === current.value
            return (
              <li key={option.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onMouseDown={keepSelection}
                  onClick={() => pick(option.value)}
                  className={`flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.07] ${focusRing} focus-visible:ring-inset ${
                    active ? 'bg-zinc-100 dark:bg-white/[0.06]' : ''
                  }`}
                >
                  <span className={`min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-100 ${option.preview}`}>{option.label}</span>
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

export default TextStyleMenu
