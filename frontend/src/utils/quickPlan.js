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

/* ------------------------------------------------------------------------------------------------------------------ *
 * Weekly plans. Same idea as the Quick Plan above: a few optional fields compiled into the rich-text HTML stored in
 * `content` by the same compiler helpers. A weekly plan's `date` is the week's first day (a "YYYY-MM-DD" string).
 * ------------------------------------------------------------------------------------------------------------------ */

export const WEEKLY_ONE_RULE_MAX = 200

/** The section cards, in default order. Key levels, Events and Risk budget start open; Goals and Rules are added with chips. */
export const WEEKLY_FIELDS = [
  { key: 'levels', label: 'Key levels', hint: 'Support, resistance, targets. One per line.', placeholder: 'e.g.\nNifty weekly high 24,900\nNifty weekly low 24,300', lines: 3 },
  { key: 'events', label: 'Events to watch', hint: 'Data, earnings, meetings. One per line.', placeholder: 'e.g.\nWed: RBI policy\nThu: US CPI', lines: 3 },
  { key: 'risk', label: 'Risk budget', hint: 'How much can the week cost you?', placeholder: 'e.g. 3% of capital for the week. Stop trading at -2% on any day.', lines: 2 },
  { key: 'goals', label: 'Goals', hint: 'What would make this a good week? One per line.', placeholder: 'e.g.\n- Take only A+ setups\n- Journal every trade the same day', lines: 3 },
  { key: 'rules', label: 'Rules', hint: 'What will you follow all week? One per line.', placeholder: 'e.g.\n- No trades in the first 10 minutes\n- Max 3 trades a day', lines: 3 }
]

export const WEEKLY_SECTION_KEYS = WEEKLY_FIELDS.map((field) => field.key)
export const DEFAULT_WEEKLY_SECTIONS = Object.freeze(['levels', 'events', 'risk'])

export const EMPTY_WEEKLY = Object.freeze({ bias: '', oneRule: '', levels: '', events: '', risk: '', goals: '', rules: '' })

const WEEKLY_LABELS = Object.fromEntries(WEEKLY_FIELDS.map((field) => [field.key, field.label]))
export const ONE_RULE_LABEL = "The one rule I won't break"

/** Accepts anything (a restored draft) and returns a safe, complete weekly values object. */
export const sanitizeWeekly = (input) => {
  const source = input && typeof input === 'object' ? input : {}
  const next = { ...EMPTY_WEEKLY }
  for (const key of WEEKLY_SECTION_KEYS) {
    if (typeof source[key] === 'string') next[key] = source[key].slice(0, QUICK_FIELD_MAX)
  }
  if (typeof source.oneRule === 'string') next.oneRule = source.oneRule.replace(/\s*[\r\n]+\s*/g, ' ').slice(0, WEEKLY_ONE_RULE_MAX)
  next.bias = BIAS_OPTIONS.includes(source.bias) ? source.bias : ''
  return next
}

/** Which section cards are open, in order. Unknown keys and repeats are dropped; anything that is not an array gives the default. */
export const sanitizeWeeklySections = (input) => {
  if (!Array.isArray(input)) return [...DEFAULT_WEEKLY_SECTIONS]
  return input.filter((key, index) => WEEKLY_SECTION_KEYS.includes(key) && input.indexOf(key) === index)
}

/** True when the bias, the one rule or an OPEN section has text. Text in a removed card does not count. */
export const hasWeeklyContent = (values, sections = DEFAULT_WEEKLY_SECTIONS) => {
  const weekly = sanitizeWeekly(values)
  return Boolean(weekly.bias) || weekly.oneRule.trim() !== '' || sanitizeWeeklySections(sections).some((key) => weekly[key].trim() !== '')
}

/** The weekly plan as the rich-text HTML stored in `content`: bias, the one rule, then the open cards in their order. Empty ones are left out. */
export const buildWeeklyPlanHtml = (values, sections = DEFAULT_WEEKLY_SECTIONS) => {
  const weekly = sanitizeWeekly(values)
  const oneRule = weekly.oneRule.trim()
  let html = weekly.bias ? `<h3>Bias</h3><p>${weekly.bias}</p>` : ''
  if (oneRule) html += `<h3>${ONE_RULE_LABEL}</h3><p><strong>${escapeHtml(oneRule)}</strong></p>`
  for (const key of sanitizeWeeklySections(sections)) {
    const body = textToHtml(weekly[key])
    if (body) html += `<h3>${WEEKLY_LABELS[key]}</h3>${body}`
  }
  return html
}

export const appendWeeklyPlanHtml = (existingHtml, values, sections = DEFAULT_WEEKLY_SECTIONS) =>
  `${String(existingHtml ?? '')}${buildWeeklyPlanHtml(values, sections)}`

/* ---- week dates: plain "YYYY-MM-DD" arithmetic on the calendar fields (UTC only as a calendar, never a local time) ---- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const KEY = /^(\d{4})-(\d{2})-(\d{2})$/

const parseKey = (key) => {
  const match = KEY.exec(String(key ?? ''))
  if (!match) return null
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const date = new Date(time)
  // reject "2026-02-31" style dates that would roll over
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]) ? date : null
}

const toKey = (date) => `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`

export const addDaysToKey = (key, days) => {
  const date = parseKey(key)
  if (!date) return key
  date.setUTCDate(date.getUTCDate() + days)
  return toKey(date)
}

/** The Monday of the week that holds `key`. An invalid key is returned unchanged. */
export const weekStartKey = (key) => {
  const date = parseKey(key)
  if (!date) return key
  return addDaysToKey(key, -((date.getUTCDay() + 6) % 7))
}

const dayMonth = (key) => {
  const date = parseKey(key)
  return date ? `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}` : ''
}

/** "Week of 2 Nov \u2013 8 Nov" for the week that starts on `startKey`. */
export const weekTitle = (startKey) => `Week of ${dayMonth(startKey)} \u2013 ${dayMonth(addDaysToKey(startKey, 6))}`

/** "Mon 2 Nov \u2013 Sun 8 Nov 2026" (both years when the week crosses New Year). */
export const weekRangeLabel = (startKey) => {
  const start = parseKey(startKey)
  const end = parseKey(addDaysToKey(startKey, 6))
  if (!start || !end) return ''
  const part = (date, withYear) => `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}${withYear ? ` ${date.getUTCFullYear()}` : ''}`
  const crossesYear = start.getUTCFullYear() !== end.getUTCFullYear()
  return `${part(start, crossesYear)} \u2013 ${part(end, true)}`
}

/** localStorage key for a weekly plan's unsaved draft. Never shared with the daily draft key. */
export const weeklyDraftKey = (plannerId, weekStart) => `tradecommit:plan-form-draft:week:${plannerId}:${weekStart}`
