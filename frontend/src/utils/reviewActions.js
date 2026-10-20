// The first next step repeats the carry-forward rule by design; avoid showing or reading that sentence twice.
const words = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)

export function isSameAction(a, b) {
  const first = words(a)
  const second = words(b)
  if (!first.length || !second.length) return false
  const [short, long] = first.length <= second.length ? [first, second] : [second, first]
  const pool = new Set(long)
  const shared = short.filter((word) => pool.has(word)).length
  return shared / short.length >= 0.7
}

export function distinctNextActions(review) {
  const actions = Array.isArray(review?.nextWeek) ? review.nextWeek : []
  const rule = review?.flywheel?.carryForward?.rule
  if (!rule) return actions
  return actions.filter((action) => !isSameAction(action, rule))
}
