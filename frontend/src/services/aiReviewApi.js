import { requestJson } from '../utils/http'

const base = (journalId) => `/api/v1/journals/${journalId}/ai-review`

/**
 * Saved review for one week (never calls the AI). `weekStart` is the Monday, YYYY-MM-DD.
 * Resolves to { weekStart, weekEnd, currency, hasStrategy, tradeCount, week, review, model, generatedAt, stale }.
 */
export const getAiReview = (journalId, weekStart) =>
  requestJson(`${base(journalId)}?weekStart=${encodeURIComponent(weekStart)}`, { cache: 'no-store' })

/** Returns the saved review when it is still current, otherwise asks the AI mentor. `force` re-writes a current one. */
export const createAiReview = (journalId, weekStart, { force = false } = {}) =>
  requestJson(base(journalId), { method: 'POST', body: { weekStart, force } })
