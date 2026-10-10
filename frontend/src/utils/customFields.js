import { isRichTextEmpty } from './richText'
// User-defined properties (name + type + value) shared by the trade form and the journal context editor.

export const MAX_CUSTOM_FIELDS = 20
export const MAX_STRATEGY_LENGTH = 6000

export const FIELD_TYPES = {
  text: { label: 'Text', icon: 'text', empty: '' },
  number: { label: 'Number', icon: 'hash', empty: '' },
  date: { label: 'Date', icon: 'calendar', empty: '' },
  checkbox: { label: 'Checkbox', icon: 'checkSquare', empty: false }
}

export const makeFieldKey = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
)

// normalises a stored field for editing: known type, value never null/undefined
export const toFormField = (field) => ({
  key: field.key,
  label: field.label ?? '',
  type: FIELD_TYPES[field.type] ? field.type : 'text',
  value: field.value ?? (FIELD_TYPES[field.type] ?? FIELD_TYPES.text).empty
})

// Fields a new trade starts with: the journal's default properties (with their default values), then any
// extra properties carried over from the most recent trade (labels only, as before).
export const buildTemplateFields = (journalContext, trades = []) => {
  const defaults = (journalContext?.attributes ?? []).map(toFormField)
  const known = new Set(defaults.map((field) => field.key))

  const latest = [...trades].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0]
  const carried = (latest?.customFields ?? [])
    .filter((field) => !known.has(field.key))
    .map(({ key, label, type }) => ({ key, label, type }))

  return [...defaults, ...carried]
}

export const hasJournalContext = (journalContext) => (
  !isRichTextEmpty(journalContext?.strategy?.trim()) || (journalContext?.attributes?.length ?? 0) > 0
)
