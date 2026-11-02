// Quick Plan: a short, guided way to write a plan. Every field is optional.
//
// Nothing here touches the API or the database schema. A Quick Plan is compiled into the same rich-text HTML a plan
// already stores in `content`, so it opens in the full editor, shows up for the AI mentor and exports like any other
// plan. Keep this file free of React / DOM so it can be unit tested with `npm test`.

export const MAX_TITLE = 120
// Per-field cap. Sized so even five fields of "<" (which escape to "&lt;"/"&amp;", up to 5x longer) stay far under the API's 16 KB JSON body limit.
export const QUICK_FIELD_MAX = 500

export const BIAS_OPTIONS = ['Bullish', 'Bearish', 'Neutral', 'Unsure']

/** Text fields in the order they appear (and are written). `bias` is a separate choice, shown after the setup. */
export const QUICK_FIELDS = [
  { key: 'setup', label: 'Setup / thesis', hint: 'What do you see, and why might it work?', placeholder: 'e.g. Nifty is consolidating under 24,800. A clean break could run to the next swing high.', lines: 3 },
  { key: 'levels', label: 'Key levels', hint: 'Support, resistance, targets. One per line.', placeholder: 'e.g.\nResistance 24,800\nSupport 24,550\nTarget 25,100', lines: 3 },
  { key: 'entry', label: 'Entry conditions', hint: 'What must happen before you enter?', placeholder: 'e.g. A 15-minute candle closes above 24,800 on rising volume.', lines: 2 },
  { key: 'invalidation', label: 'Invalidation', hint: 'What proves the idea wrong?', placeholder: 'e.g. Price closes back below 24,700. Exit, no averaging down.', lines: 2 },
  { key: 'risk', label: 'Risk', hint: 'How much are you willing to lose?', placeholder: 'e.g. 1% of capital on this trade, max 2 attempts.', lines: 2 }
]

const TEXT_KEYS = QUICK_FIELDS.map((field) => field.key)

export const EMPTY_QUICK = Object.freeze({ setup: '', bias: '', levels: '', entry: '', invalidation: '', risk: '' })

/** Heading text used when the plan is written to the editor (kept in step with the field labels). */
const SECTION_ORDER = ['setup', 'bias', 'levels', 'entry', 'invalidation', 'risk']
const SECTION_LABELS = { setup: 'Setup / thesis', bias: 'Bias', levels: 'Key levels', entry: 'Entry conditions', invalidation: 'Invalidation', risk: 'Risk' }

/** Accepts anything (a restored draft, a template) and returns a safe, complete values object. */
export const sanitizeQuick = (input) => {
  const source = input && typeof input === 'object' ? input : {}
  const next = { ...EMPTY_QUICK }
  for (const key of TEXT_KEYS) {
    if (typeof source[key] === 'string') next[key] = source[key].slice(0, QUICK_FIELD_MAX)
  }
  next.bias = BIAS_OPTIONS.includes(source.bias) ? source.bias : ''
  return next
}

/** True when at least one Quick Plan field has visible text (or a bias is chosen). */
export const hasQuickContent = (values) => {
  const quick = sanitizeQuick(values)
  return Boolean(quick.bias) || TEXT_KEYS.some((key) => quick[key].trim() !== '')
}

const escapeHtml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const BULLET = /^\s*(?:[-*\u2022])\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/

/** One field's text as HTML: runs of "- item" become a bullet list, "1. item" a numbered list, other lines paragraphs. */
export const textToHtml = (text) => {
  const lines = String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  let html = ''
  let open = null // 'ul' | 'ol' | null
  const close = () => {
    if (open) html += `</${open}>`
    open = null
  }
  for (const line of lines) {
    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    const kind = bullet ? 'ul' : numbered ? 'ol' : null
    if (kind) {
      if (open !== kind) {
        close()
        html += `<${kind}>`
        open = kind
      }
      html += `<li>${escapeHtml((bullet ?? numbered)[1])}</li>`
    } else {
      close()
      html += `<p>${escapeHtml(line)}</p>`
    }
  }
  close()
  return html
}

/** The Quick Plan as the rich-text HTML stored in `content`. Empty sections are left out; nothing filled in gives ''. */
export const buildQuickPlanHtml = (values) => {
  const quick = sanitizeQuick(values)
  return SECTION_ORDER.map((key) => {
    const body = key === 'bias' ? (quick.bias ? `<p>${quick.bias}</p>` : '') : textToHtml(quick[key])
    return body ? `<h3>${SECTION_LABELS[key]}</h3>${body}` : ''
  }).join('')
}

const truncate = (text, max) => {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:\u2013-]+$/, '')}\u2026`
}

/**
 * Title for a plan whose title was left empty. The backend still requires a title, so the form never sends an empty one:
 * the first line of the setup if there is one, otherwise a dated name. `dateLabel` is passed in already formatted
 * (e.g. "Mon 2 Nov") to keep this function free of locale / timezone behaviour.
 */
export const deriveTitle = ({ setup = '', bias = '', dateLabel = '' } = {}) => {
  const firstLine = String(setup).split(/\r?\n/).map((line) => line.trim()).find(Boolean)
  if (firstLine) return truncate(firstLine, 60)
  const base = BIAS_OPTIONS.includes(bias) && bias !== 'Unsure' ? `${bias} plan` : 'Plan'
  return dateLabel ? `${base} \u00b7 ${dateLabel}` : base
}

/** Plain-text check on editor HTML ("" and "<p></p>" both count as empty). */
export const htmlHasText = (html) => String(html ?? '').replace(/<(?!img\b)[^>]*>/gi, '').replace(/&nbsp;|\s/g, '') !== '' || /<img\b/i.test(String(html ?? ''))
