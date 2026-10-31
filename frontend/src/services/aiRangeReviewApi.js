import { requestJson } from '../utils/http'

const base = (journalId) => `/api/v1/journals/${journalId}/ai-range-reviews`

/**
 * Date-range AI reviews: one review for any stretch of dates (a swing trader's whole campaign, a month, a quarter)
 * instead of week by week. Written by the same mentor, with the same unlock rule and allowance as weekly reviews:
 * at least 5 trades in the range, at most 1 new review a day and 3 a week.
 */

/**
 * Saved review for exactly this range (never calls the AI, never uses allowance). `start` / `end` are YYYY-MM-DD, inclusive.
 * Resolves to { kind: 'range', id, rangeStart, rangeEnd, days, currency, hasStrategy, tradeCount, planner,
 *   stats: { trades, closed, netPnl, winRate, expectancyR, rewardRisk, payoffRatio, avgRrr (legacy alias of expectancyR) }, review, model, generatedAt, stale, access }
 * `access` has the same shape as for weekly reviews (canGenerate, reason, message, newTrades, threshold, usage...).
 */
export const previewRangeReview = (journalId, start, end) =>
  requestJson(`${base(journalId)}/preview?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { cache: 'no-store' })

/** Returns the saved review when it is current, otherwise asks the mentor. Rejects with the server's explanation when not allowed. */
export const createRangeReview = (journalId, start, end) => requestJson(base(journalId), { method: 'POST', body: { start, end }, timeoutMs: 200_000 })

/**
 * Cheap check (never calls the AI, never uses allowance): { generating, savedAt }. `generating` is true while the server is
 * still writing this trader's review; `savedAt` is when the saved review for exactly this range was last written (or null).
 * Used to recover when the POST above was cut off while the server kept working.
 */
export const getRangeReviewStatus = (journalId, start, end) =>
  requestJson(`${base(journalId)}/status?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { cache: 'no-store' })

/**
 * The one change the journal's latest review (weekly or range) asked the trader to carry into the next plan, so the
 * planner can show it while a plan is written. Resolves to { commitment: { start, end, rule, planLine, checkpoint, source } | null }.
 * Never calls the AI.
 */
export const getCarryForward = (journalId) => requestJson(`${base(journalId)}/carry-forward`, { cache: 'no-store' })

/** One saved range review by id (opened from the history). */
export const getRangeReview = (journalId, reviewId) => requestJson(`${base(journalId)}/${encodeURIComponent(reviewId)}`, { cache: 'no-store' })

/**
 * Every past review of the journal, weekly and date-range together, newest first. Light rows, free to browse.
 * Resolves to { currency, items: [{ kind: 'week' | 'range', id, start, end, headline, leakCount (null for older reviews),
 *   tradeCount, stats, generatedAt }], hasMore, nextBefore }. Pass `before: nextBefore` for the next page.
 */
export const listReviewHistory = (journalId, { limit = 20, before } = {}) =>
  requestJson(`${base(journalId)}?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`, { cache: 'no-store' })
