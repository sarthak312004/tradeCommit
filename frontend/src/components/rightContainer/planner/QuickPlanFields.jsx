import { useId, useState } from 'react'
import { BIAS_OPTIONS, QUICK_FIELDS, QUICK_FIELD_MAX } from '../../../utils/quickPlan'
import { BLANK_TEMPLATE_ID, EXAMPLE_PLAN, QUICK_TEMPLATES, getTemplate } from '../../../utils/quickPlanTemplates'

// Quiet surfaces: a hairline border, a cyan edge only on focus / selection. No glow, no gradients.
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

const labelClass = 'text-[13px] font-semibold text-zinc-800 dark:text-zinc-200'
const hintClass = 'text-xs text-zinc-500 dark:text-zinc-400'

/** Read-only sample plan. Shown on demand; never stored, never sent. */
function ExamplePanel({ canApply, onApply, onDismiss }) {
  const { values } = EXAMPLE_PLAN
  return (
    <section aria-label="Example plan" className="rounded-xl border border-dashed border-zinc-300 px-4 py-3.5 dark:border-white/[0.14]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-cyan-800 dark:text-cyan-300">Example · not saved</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{EXAMPLE_PLAN.title.replace(/^Example:\s*/, '')}</p>
        </div>
        <button type="button" onClick={onDismiss} className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-zinc-500 transition-colors hover:text-zinc-900 focus:outline-none focus-visible:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">Hide</button>
      </div>
      <dl className="mt-3 space-y-2.5 text-[13px] leading-5">
        {QUICK_FIELDS.slice(0, 1).map((field) => (
          <div key={field.key}><dt className="text-zinc-500 dark:text-zinc-400">{field.label}</dt><dd className="text-zinc-800 dark:text-zinc-200">{values[field.key]}</dd></div>
        ))}
        <div><dt className="text-zinc-500 dark:text-zinc-400">Bias</dt><dd className="text-zinc-800 dark:text-zinc-200">{values.bias}</dd></div>
        {QUICK_FIELDS.slice(1).map((field) => (
          <div key={field.key}><dt className="text-zinc-500 dark:text-zinc-400">{field.label}</dt><dd className="whitespace-pre-line text-zinc-800 dark:text-zinc-200">{values[field.key].replace(/^- /gm, '\u2022 ')}</dd></div>
        ))}
      </dl>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button type="button" onClick={onApply} disabled={!canApply} className={`${chipBase} ${chipOff} disabled:cursor-default disabled:opacity-50`}>Copy into empty fields</button>
        <span className={hintClass}>{canApply ? 'Your own text is never overwritten. Edit anything, then save.' : 'Every field already has your text.'}</span>
      </div>
    </section>
  )
}

/**
 * The Quick Plan form body: optional template, optional example, a bias choice and five short text fields.
 * Controlled: `values` is { setup, bias, levels, entry, invalidation, risk }; `onChange(next)` receives the whole object.
 */
function QuickPlanFields({ values, onChange, templateId, onTemplateChange, autoFocus = false, onOpenFullEditor }) {
  const uid = useId()
  const [showExample, setShowExample] = useState(false)
  const template = getTemplate(templateId)

  const set = (key, value) => onChange({ ...values, [key]: value })
  const emptyKeys = [...QUICK_FIELDS.map((field) => field.key), 'bias'].filter((key) => !String(values[key] ?? '').trim())

  const applyExample = () => {
    const next = { ...values }
    for (const key of emptyKeys) next[key] = EXAMPLE_PLAN.values[key]
    onChange(next)
  }

  const renderField = (field, index) => (
    <div key={field.key}>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
        <label htmlFor={`${uid}-${field.key}`} className={labelClass}>{field.label}</label>
        <span id={`${uid}-${field.key}-hint`} className={hintClass}>
          {field.hint}
          {values[field.key].length >= QUICK_FIELD_MAX * 0.8 && <span aria-live="polite"> · {values[field.key].length}/{QUICK_FIELD_MAX}</span>}
        </span>
      </div>
      <textarea
        id={`${uid}-${field.key}`}
        aria-describedby={`${uid}-${field.key}-hint`}
        value={values[field.key]}
        onChange={(event) => set(field.key, event.target.value)}
        rows={field.lines}
        maxLength={QUICK_FIELD_MAX}
        autoFocus={autoFocus && index === 0}
        placeholder={template.placeholders[field.key] ?? field.placeholder}
        className={fieldClass}
      />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="group" aria-label="Template" className="flex flex-wrap items-center gap-1.5">
          <span className={`${hintClass} mr-1`}>Template</span>
          {QUICK_TEMPLATES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === template.id}
              onClick={() => onTemplateChange(item.id)}
              className={`${chipBase} ${item.id === template.id ? chipOn : chipOff}`}
            >
              {item.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-expanded={showExample}
          onClick={() => setShowExample((open) => !open)}
          className="text-xs font-medium text-cyan-800 transition-colors hover:text-cyan-950 hover:underline focus:outline-none focus-visible:underline dark:text-cyan-300 dark:hover:text-cyan-200"
        >
          {showExample ? 'Hide example' : 'Try an example'}
        </button>
      </div>
      {template.id !== BLANK_TEMPLATE_ID && <p className={`-mt-3 ${hintClass}`}>{template.description} The hints in the fields below follow this template.</p>}

      {showExample && <ExamplePanel canApply={emptyKeys.length > 0} onApply={applyExample} onDismiss={() => setShowExample(false)} />}

      {renderField(QUICK_FIELDS[0], 0)}

      <div>
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
          <span id={`${uid}-bias`} className={labelClass}>Bias</span>
          <span className={hintClass}>Which way do you lean today?</span>
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

      {QUICK_FIELDS.slice(1).map((field, index) => renderField(field, index + 1))}

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

export default QuickPlanFields
