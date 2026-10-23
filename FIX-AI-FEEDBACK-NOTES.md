# AI feedback fix

Files changed (drop into the same paths, keep the folder structure):

- backend/src/utils/gemini.js            model fallback chain, per-model cooldown, separate retry budgets, daily-quota detection, clear logs
- backend/src/utils/geminiQueue.js       no more long global lock-outs; pause capped at 2 min; one friendly message
- backend/src/utils/aiQuota.js           error-note wording (no duplicate "not charged" text)
- backend/src/middlewares/rateLimit.middleware.js   new `refundFailed` option + `res.locals.skipRateLimit`
- backend/src/app.js                     AI limiter now uses refundFailed: true
- backend/src/controllers/aiReview.controller.js        refunds IP limiter for cached / joined responses
- backend/src/controllers/aiRangeReview.controller.js   same
- backend/src/routes/aiReview.routes.js, aiRangeReview.routes.js   comments only (routes/paths unchanged)
- DEPLOYMENT.md                          documents GEMINI_MODEL / GEMINI_FALLBACK_MODELS

Routes are unchanged:
  GET/POST /api/v1/journals/:journalId/ai-review, GET .../ai-review/quota
  GET/POST /api/v1/journals/:journalId/ai-range-reviews, /preview, /carry-forward, /:reviewId

Optional .env: GEMINI_MODEL, GEMINI_FALLBACK_MODELS, AI_MIN_INTERVAL_MS (default now 4000).
No frontend changes needed. Restart the backend after copying.
