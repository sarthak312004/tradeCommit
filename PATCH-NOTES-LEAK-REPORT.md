# AI feedback: remove the score and strategy verdict, add "Where you lost money and time"

## What changed for users
- Removed the "% of checkable rules followed" score ring, the "Followed / Mostly followed..." pill and the percentage in history, PDF download and voice readout. The rule-by-rule list (followed / broken / can't tell, with evidence) stays, with a short written explanation and no score.
- Removed the "Keep / Tweak / Rethink the strategy" verdict and the "Strategy check" section (including "Adapting to the market"). The AI is now told not to give an overall verdict on the strategy and not to comment on market conditions.
- Added "Where you lost money and time". It is measured by CODE from the trade logs, not written by the AI, so the same trades always show the same list. Each item has: a title, Money / Time tag, the amount those exact trades netted, what the logs show, a "How to stop it" line and the trades involved.

## What the leak checks look for (all deterministic, loss-only, minimum sample per check)
1. Re-entering an instrument right after it stopped you out the same day
2. Other trades taken after a same-day loss
3. Losses that ran past the logged stop (reports only the loss beyond 1R)
4. Closed trades with no stop logged
5. A few trades risking far more than the usual size
6. Busy days: trades beyond your usual daily count (money and time)
7. An instrument that keeps losing (4+ closed trades, 40% or fewer winners)
8. One direction losing while the other makes money
9. Your own checkbox property splitting results (blank values are never counted as "no")
10. Days with no written plan (only when a planner is connected)
11. Most trades have no notes (time leak, no money amount)

Safeguards: order-based checks (1, 2, 6) are skipped when many trades share one date (backfilled / batch-imported). Under 30 closed trades the section says "early signals". Amounts can overlap, so the UI says not to add them up. Fewer than 3 closed trades shows a plain "too few trades" message.

The AI receives the same list as ground truth and is told to explain it from the trader's notes, quote the numbers exactly, and never recompute them. "Close the loop" (flywheel) is unchanged.

## Routes
No routes were added or changed. Same endpoints, same paths:
- GET/POST /api/v1/journals/:journalId/ai-review, GET .../ai-review/quota
- GET/POST /api/v1/journals/:journalId/ai-range-reviews, /preview, /carry-forward, /:reviewId
- GET /api/v1/journals/:journalId/ai-range-reviews (history list)
Response changes (additive only): a saved review now has `review.leakReport`; the history rows have `leakCount`.

## Production safety
- No database migration. Reviews are stored as free-form JSON. Reviews already saved keep working: they simply do not show the leaks section, and their old score / strategy verdict are no longer shown anywhere.
- Review hashes are unchanged, so existing reviews are NOT marked stale and nobody loses or re-spends a review. The new section appears the next time a review is generated.
- Browsers still running an older cached version of the app get harmless placeholder fields (`discipline.verdict`, `discipline.score = null`, `strategyFeedback` empty) so they do not crash. Those placeholders are never shown by this version.
- Gemini schema is smaller (no score, no strategy block), so responses should be slightly shorter.

## Files
Backend (new): backend/src/utils/leakReport.js, backend/src/utils/leakReport.test.js
Backend (changed): utils/aiMentorPrompt.js, utils/aiRangePrompt.js, controllers/aiReview.controller.js, controllers/aiRangeReview.controller.js
Frontend (changed): ReviewReport.jsx, reviewParts.jsx, ReviewHistoryPanel.jsx, ReviewDownloadButton.jsx, ListenControls.jsx, RangeReviewPanel.jsx (journal folder); utils/reviewSpeech.js, services/aiRangeReviewApi.js, pages/AuthPage.jsx (landing copy and sample card)

## Checked
- `npm test` in backend: 14 of 14 pass (9 new tests for the leak checks, sanitiser and prompt).
- `vite build` in frontend succeeds. The new section was rendered with new-format, old-format and empty data.
- Not run: a live Gemini call and a real browser session. After deploying, generate one weekly and one range review on a journal that has re-entries or missing stops and confirm the section shows.
- Deploy: copy files keeping the folder structure, restart the backend, rebuild the frontend (the Dockerfile already does this).
