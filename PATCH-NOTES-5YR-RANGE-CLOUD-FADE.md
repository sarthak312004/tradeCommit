# Patch: 5-year AI feedback range, cloud fade, calmer trade cards

Copy these files over the same paths in your project (patch only, nothing else is touched).

## Changed / new files
backend/src/controllers/aiRangeReview.controller.js   range limit default 366 -> 1830 days (5 years + slack)
backend/src/utils/aiRangePrompt.js                    ranges over 26 weeks are summarised per month in the prompt
frontend/src/components/rightContainer/journal/RangeReviewPanel.jsx   MAX_RANGE_DAYS 366 -> 1830, friendlier limit message
frontend/src/components/common/ScrollFade.jsx         NEW  scroll area with a soft cloud at the bottom edge
frontend/src/components/common/cloudFade.css          NEW  the cloud (blur + soft puffs), light and dark
frontend/src/pages/MainJournal.jsx                    wraps the journal scroller in ScrollFade
frontend/src/components/rightContainer/journal/TradeCard.jsx    calmer chips: hairline border, lighter surface, no resting shadow, tighter rows
frontend/src/components/rightContainer/journal/TradeJournal.jsx chip grid gap 12px -> 10px

## Routes (unchanged, no new endpoints)
All mounted at /api/v1/journals/:journalId/ai-range-reviews
GET  /preview?start=YYYY-MM-DD&end=YYYY-MM-DD   saved review + numbers for that range (free, no Gemini)
POST /  { start, end }                           writes a review (still needs >= 5 trades, 1/day, 3/week)
GET  /                                           review history
GET  /carry-forward                              latest commitment
GET  /:reviewId                                  one saved range review

## Deploy note
If AI_RANGE_MAX_DAYS is set in your Render environment variables it overrides the new default.
Remove it, or set it to 1830, otherwise the server still rejects ranges over the old limit.
