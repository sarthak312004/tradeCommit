import { useEffect, useId, useRef, useState } from 'react'
import { BIAS_OPTIONS, ONE_RULE_LABEL, QUICK_FIELD_MAX, WEEKLY_FIELDS, WEEKLY_ONE_RULE_MAX } from '../../../utils/quickPlan'

// Same quiet surfaces as QuickPlanFields: hairline borders, a cyan edge only on focus / selection.
const fieldClass = [
  'block w-full resize-none rounded-lg border border-zinc-200 bg-transparent px-3 py-2',
  'text-[15px] leading-6 text-zinc-900 outline-none transition-colors duration-150',
  'placeholder:text-zinc-400 hover:border-zinc-300',
  'focus:border-cyan-600/60 dark:border-white/[0.10] dark:text-zinc-100 dark:placeholder:text-zinc-600',
  'dark:hover:border-white/[0.18] dark:focus:border-cyan-400/50',
  '[field-sizing:content]'
].join(' ')

const chipBase = 'inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors duration-150 focus:outline-none focus-visible:border-cyan-600/60 dark:focus-visible:border-cyan-400/60'
const chipOff = 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/[0.10] dark:text-zinc-400 dark:hover:border-white/[0.18] dark:hover:bg-white/[0.05] dark:hover:text-zinc-100'
const chipOn = 'border-cyan-600/50 bg-cyan-600/[0.07] text-cyan-800 dark:border-cyan-400/40 dark:bg-cyan-400/[0.08] dark:text-cyan-300'
const chipAdd = `${chipBase} ${chipOff} border-dashed`

const labelClass = 'text-[13px] font-semibold text-zinc-800 dark:text-zinc-200'
const hintClass = 'text-xs text-zinc-500 dark:text-zinc-400'

// Small icon buttons inside a card. The remove button shows on hover or focus (always on touch screens, which have no hover).
const cardIconButton = 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:bg-zinc-100 focus-visible:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100 dark:focus-visible:bg-white/[0.08] dark:focus-visible:text-zinc-100'
const removeButton = `${cardIconButton} opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100`

const fadeStyles = `
@keyframes weekly-card-in { from { opacity: 0; } to { opacity: 1; } }
.weekly-card-in { animation: weekly-card-in 150ms ease-out; }
@media (prefers-reduced-motion: reduce) { .weekly-card-in { animation: none; } }
`

const GripIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
    <circle cx="5.5" cy="3.5" r="1.2" /><circle cx="10.5" cy="3.5" r="1.2" />
    <circle cx="5.5" cy="8" r="1.2" /><circle cx="10.5" cy="8" r="1.2" />
    <circle cx="5.5" cy="12.5" r="1.2" /><circle cx="10.5" cy="12.5" r="1.2" />
  </svg>
)

const CloseIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
)

/**
 * The weekly Quick Plan body: bias pills, the one rule, then the open section cards (reorderable, removable) and
 * dashed chips to add the ones that are closed. Controlled: `values` is the weekly values object, `sections` the
 * ordered keys of the open cards. A removed card keeps its text, so adding it back restores it.
 */
function WeeklyPlanFields({ values, sections, onChange, onSectionsChange, autoFocus = false, onOpenFullEditor }) {
  const uid = useId()
  const [dragKey, setDragKey] = useState(null)
  const [announcement, setAnnouncement] = useState('')
  const gripRefs = useRef({})
  const refocusRef = useRef(null)

  const set = (key, value) => onChange({ ...values, [key]: value })
  const labelFor = (key) => WEEKLY_FIELDS.find((field) => field.key === key)?.label ?? key
  const closedFields = WEEKLY_FIELDS.filter((field) => !sections.includes(field.key))

  // after a keyboard move the grip button is re-created in a new spot: put focus back on it
  useEffect(() => {
    if (refocusRef.current) {
      gripRefs.current[refocusRef.current]?.focus()
      refocusRef.current = null
    }
  }, [sections])

  const move = (key, toIndex) => {
    const from = sections.indexOf(key)
    if (from < 0 || toIndex < 0 || toIndex >= sections.length || toIndex === from) return
    const next = [...sections]
    next.splice(from, 1)
    next.splice(toIndex, 0, key)
    onSectionsChange(next)
    setAnnouncement(`${labelFor(key)} moved to position ${toIndex + 1} of ${next.length}`)
  }

  const handleGripKey = (event, key) => {
    const index = sections.indexOf(key)
    if (event.key === 'ArrowUp') { event.preventDefault(); refocusRef.current = key; move(key, index - 1) }
    if (event.key === 'ArrowDown') { event.preventDefault(); refocusRef.current = key; move(key, index + 1) }
  }

  const remove = (key) => {
    onSectionsChange(sections.filter((item) => item !== key))
    setAnnouncement(`${labelFor(key)} removed`)
  }

  const add = (key) => {
    onSectionsChange([...sections, key])
    setAnnouncement(`${labelFor(key)} added`)
  }

  const renderCard = (key, index) => {
    const field = WEEKLY_FIELDS.find((item) => item.key === key)
    if (!field) return null
    const id = `${uid}-${key}`
    return (
      <section
        key={key}
        aria-label={field.label}
        onDragOver={(event) => { if (dragKey) event.preventDefault() }}
        onDrop={(event) => { event.preventDefault(); if (dragKey) move(dragKey, index); setDragKey(null) }}
        className={`weekly-card-in group rounded-xl border border-zinc-200 px-3.5 pb-3.5 pt-2.5 transition-colors duration-150 dark:border-white/[0.10] ${dragKey === key ? 'opacity-60' : ''} ${dragKey && dragKey !== key ? 'border-dashed' : ''}`}
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <button
            type="button"
            ref={(node) => { gripRefs.current[key] = node }}
            draggable
            onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', key); setDragKey(key) }}
            onDragEnd={() => setDragKey(null)}
            onKeyDown={(event) => handleGripKey(event, key)}
            aria-label={`Reorder ${field.label}. Use the up and down arrow keys, or drag.`}
            className={`${cardIconButton} cursor-grab active:cursor-grabbing`}
          >
            <GripIcon />
          </button>
          <label htmlFor={id} className={labelClass}>{field.label}</label>
          <span id={`${id}-hint`} className={`${hintClass} ml-1 min-w-0 flex-1 truncate`}>
            {field.hint}
            {values[key].length >= QUICK_FIELD_MAX * 0.8 && <span aria-live="polite"> · {values[key].length}/{QUICK_FIELD_MAX}</span>}
          </span>
          <button type="button" onClick={() => remove(key)} aria-label={`Remove ${field.label}`} className={removeButton}>
            <CloseIcon />
          </button>
        </div>
        <textarea
          id={id}
          aria-describedby={`${id}-hint`}
          value={values[key]}
          onChange={(event) => set(key, event.target.value)}
          rows={field.lines}
          maxLength={QUICK_FIELD_MAX}
          autoFocus={autoFocus && index === 0}
          placeholder={field.placeholder}
          className={fieldClass}
        />
      </section>
    )
  }

  return (
    <div className="space-y-5">
      <style>{fadeStyles}</style>

      <div>
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
          <span id={`${uid}-bias`} className={labelClass}>Bias</span>
          <span className={hintClass}>Which way do you lean this week?</span>
        </div>
        <div role="group" aria-labelledby={`${uid}-bias`} className="flex flex-wrap gap-1.5">
          {BIAS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={values.bias === option}
              onClick={() => set('bias', values.bias === option ? '' : option)}
              className={`${chipBase} ${values.bias === option ? chipOn : chipOff}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-cyan-600/40 bg-cyan-600/[0.05] px-3.5 pb-3.5 pt-3 dark:border-cyan-400/30 dark:bg-cyan-400/[0.06]">
        <label htmlFor={`${uid}-one-rule`} className="block text-[13px] font-semibold text-cyan-900 dark:text-cyan-200">{ONE_RULE_LABEL}</label>
        <input
          id={`${uid}-one-rule`}
          type="text"
          autoComplete="off"
          value={values.oneRule}
          onChange={(event) => set('oneRule', event.target.value)}
          maxLength={WEEKLY_ONE_RULE_MAX}
          placeholder="e.g. No trades after my daily loss limit."
          className="mt-1.5 block w-full rounded-lg border border-cyan-600/30 bg-white/70 px-3 py-2 text-[15px] font-medium leading-6 text-zinc-900 outline-none transition-colors duration-150 placeholder:font-normal placeholder:text-zinc-500 hover:border-cyan-600/50 focus:border-cyan-600/70 dark:border-cyan-400/25 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:hover:border-cyan-400/40 dark:focus:border-cyan-400/60"
        />
      </div>

      {sections.map(renderCard)}

      {closedFields.length > 0 && (
        <div role="group" aria-label="Add a section" className="flex flex-wrap items-center gap-1.5">
          {closedFields.map((field) => (
            <button key={field.key} type="button" onClick={() => add(field.key)} aria-label={`Add ${field.label} section`} className={chipAdd}>
              + {field.label}
            </button>
          ))}
        </div>
      )}

      <span role="status" aria-live="polite" className="sr-only">{announcement}</span>

      <p className={`${hintClass} border-t border-zinc-200 pt-4 dark:border-white/[0.08]`}>
        Everything here is optional.{' '}
        <button type="button" onClick={onOpenFullEditor} className="font-medium text-cyan-800 transition-colors hover:underline focus:outline-none focus-visible:underline dark:text-cyan-300">
          Need screenshots, checklists or more room? Open the full editor
        </button>
        . What you wrote above moves in with you.
      </p>
    </div>
  )
}

export default WeeklyPlanFields
