import { requestJson } from '../utils/http'

const base = (journalId) => `/api/v1/journals/${journalId}/ai-review`

/**
 * Saved review for one week (never calls the AI). `weekStart` is the Monday, YYYY-MM-DD.
 * Resolves to { weekStart, weekEnd, currency, hasStrategy, tradeCount, week, review, model, generatedAt, stale, access }.
 * `access` says whether a new review may be generated now:
 *   { needsReview, canGenerate, reason, message, newTrades, threshold, nextAvailableAt,
 *     usage: { day: { used, limit }, week: { used, limit } } }
 * `reason` is null, 'up_to_date', 'not_enough_trades', 'daily_limit', 'weekly_limit' or 'busy'.
 */
export const getAiReview = (journalId, weekStart) =>
  requestJson(`${base(journalId)}?weekStart=${encodeURIComponent(weekStart)}`, { cache: 'no-store' })

/**
 * Returns the saved review when it is still current, otherwise asks the AI mentor. Rejects with the server's
 * explanation (403 not unlocked yet, 429 limit reached or mentor busy) when a new review is not allowed.
 */
export const createAiReview = (journalId, weekStart) => requestJson(base(journalId), { method: 'POST', body: { weekStart } })

/**
 * The trader's allowance, shared by weekly and date-range reviews (a review written in either one counts in both).
 * Resolves to { usage: { day: { used, limit }, week: { used, limit } }, blocked, reason, nextAvailableAt, message, generating }.
 * Never calls the AI and never uses allowance.
 */
export const getAiQuota = (journalId) => requestJson(`${base(journalId)}/quota`, { cache: 'no-store' })
