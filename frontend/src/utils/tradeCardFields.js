import { formatDateKey, formatMoney, formatR, getTradePnl, getTradeR, toDateKey, toneOf } from './tradeAnalytics'

/* ------------------------------------------------------------------
 * What a trade chip can show in the panel that opens when you hover it (at most MAX_CARD_FIELDS).
 * Pure helpers (no React). The choice is stored per browser by useTradeCardFields.
 * ------------------------------------------------------------------ */

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const hasValue = (value) => value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '')
const rawText = (raw) => (hasValue(raw) ? value(String(raw)) : null)

/** Return on the position: pnl / (entry x quantity). `null` while open or when it cannot be worked out. */
export const getTradeReturn = (trade) => {
  const pnl = getTradePnl(trade)
  const entry = toNumber(trade.entryPrice ?? trade.entry)
  const quantity = toNumber(trade.quantity ?? trade.qty)
  if (pnl === null || entry === null || quantity === null) return null
  const cost = Math.abs(entry * quantity)
  return cost > 0 ? pnl / cost : null
}

export const formatSignedPercent = (value) => {
  if (value === null || value === undefined) return '-'
  const text = `${Math.abs(value * 100).toFixed(2)}%`
  if (value < 0 && /[1-9]/.test(text)) return `-${text}`
  return value > 0 ? `+${text}` : text
}

// notes are saved as HTML: show the text only, on one line, without screenshots
const notesPreview = (html) => {
  if (!html || typeof html !== 'string') return ''
  const body = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body
  body.querySelectorAll('img').forEach((image) => image.remove())
  const text = (body.textContent ?? '').replace(/\s+/g, ' ').trim()
  return text.length > 220 ? `${text.slice(0, 220).trimEnd()}...` : text
}

const value = (text, tone = 'neutral') => ({ text, tone })

// every built-in field: id, label, group (for the picker) and how to read it from a trade
export const BUILT_IN_FIELDS = [
  { id: 'quantity', label: 'Quantity', group: 'Trade', get: (trade) => rawText(trade.quantity ?? trade.qty) },
  { id: 'entry', label: 'Entry price', group: 'Trade', get: (trade) => rawText(trade.entryPrice ?? trade.entry) },
  { id: 'exit', label: 'Exit price', group: 'Trade', get: (trade) => rawText(trade.exitPrice ?? trade.exit) },
  { id: 'stopLoss', label: 'Stop loss', group: 'Trade', get: (trade) => rawText(trade.stopLoss) },
  { id: 'positionSize', label: 'Position size', group: 'Trade', get: (trade, currency) => {
    const entry = toNumber(trade.entryPrice ?? trade.entry)
    const quantity = toNumber(trade.quantity ?? trade.qty)
    return entry === null || quantity === null ? null : value(formatMoney(Math.abs(entry * quantity), { currency }))
  } },
  { id: 'rMultiple', label: 'R multiple', group: 'Result', get: (trade) => {
    const r = getTradeR(trade)
    return r === null ? null : value(formatR(r), toneOf(r))
  } },
  { id: 'returnPct', label: 'Return', group: 'Result', get: (trade) => {
    const result = getTradeReturn(trade)
    return result === null ? null : value(formatSignedPercent(result), toneOf(result))
  } },
  { id: 'risk', label: 'Risk at stop', group: 'Result', get: (trade, currency) => {
    const entry = toNumber(trade.entryPrice ?? trade.entry)
    const stop = toNumber(trade.stopLoss)
    const quantity = toNumber(trade.quantity ?? trade.qty)
    if (entry === null || stop === null || quantity === null) return null
    // same rule as the R multiple: the distance from entry to stop, times the quantity
    return value(formatMoney(Math.abs(entry - stop) * quantity, { currency }))
  } },
  { id: 'notes', label: 'Notes', group: 'More', wide: true, get: (trade) => {
    const notes = notesPreview(trade.analysis)
    return notes ? value(notes) : null
  } },
  { id: 'images', label: 'Screenshots', group: 'More', get: (trade) => (
    trade.images?.length ? value(String(trade.images.length)) : null
  ) }
]

// a chip's hover panel shows at most this many details
export const MAX_CARD_FIELDS = 3

// shown until the person picks something else
export const DEFAULT_CARD_FIELDS = ['entry', 'exit', 'stopLoss']

/** Drops duplicates and anything past the limit, keeping the order the person picked them in. */
export const limitCardFields = (ids) => [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string'))].slice(0, MAX_CARD_FIELDS)

export const customFieldId = (key) => `custom:${key}`

// the same property can exist under several keys (each trade can carry its own copy), so properties are
// told apart by name and type, not by key: "Setup" typed on ten trades is one property
const normalizeLabel = (label) => String(label ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
const sameProperty = (a, b) => normalizeLabel(a.label) === normalizeLabel(b.label) && (a.type ?? 'text') === (b.type ?? 'text')

/**
 * The journal's own properties, as they appear on the trade form: [{ id, key, label, type }], each listed once.
 * The journal's default properties come first (even before any trade uses them), then the ones found on trades.
 * Unnamed properties are skipped: there is nothing to tell them apart or to label them with.
 */
export const collectCustomFieldOptions = (trades = [], defaults = []) => {
  const found = new Map()
  const add = (field) => {
    if (!field?.key || !normalizeLabel(field.label)) return
    const type = field.type ?? 'text'
    const name = `${normalizeLabel(field.label)}|${type}`
    if (found.has(name)) return // keep the first one seen
    found.set(name, { id: customFieldId(field.key), key: field.key, label: String(field.label).trim().replace(/\s+/g, ' '), type })
  }
  defaults.forEach(add)
  for (const trade of trades) {
    for (const field of trade.customFields ?? []) add(field)
  }
  return [...found.values()]
}

const customDefinition = (option) => ({
  id: option.id,
  label: option.label,
  group: 'Your properties',
  get: (trade) => {
    // match by name and type, so a trade that holds its own copy of the property is still found
    const field = (trade.customFields ?? []).find((item) => item.key === option.key) ?? (trade.customFields ?? []).find((item) => sameProperty(item, option))
    const raw = field?.value
    if (!hasValue(raw)) return null
    if (field.type === 'checkbox' || typeof raw === 'boolean') return value(raw ? 'Yes' : 'No')
    if (field.type === 'date') return value(formatDateKey(toDateKey(raw), { withYear: true }) || String(raw))
    return value(String(raw))
  }
})

/** Every field the picker offers: the built-in trade-form fields, then the journal's own properties. */
export const buildFieldChoices = (customOptions = []) => [
  ...BUILT_IN_FIELDS.map(({ id, label, group }) => ({ id, label, group })),
  ...customOptions.map((option) => ({ id: option.id, label: option.label, group: 'Your properties' }))
]

/** The selected ids as ready-to-render definitions, in the order they were picked (ids that no longer exist are skipped). */
export const resolveCardFields = (selectedIds, customOptions = []) => {
  const definitions = new Map([...BUILT_IN_FIELDS, ...customOptions.map(customDefinition)].map((definition) => [definition.id, definition]))
  return limitCardFields(selectedIds).map((id) => definitions.get(id)).filter(Boolean)
}
