# Mentor unlock progress and date-range reviews

This document summarizes the mentor unlock progress, date-range reviews, and review loading and allowance behavior now included in TradeCommit.
Run `npm run build` from `frontend/` to build the UI.

## Routes
- GET  /api/v1/progress/mentor             progress towards the first review: { count, target, completed, celebrated, badge }
- POST /api/v1/progress/mentor/celebrated  marks the "feedback is here" badge as seen
- Existing /ai-range-reviews routes unchanged (preview, create, history, by id); /ai-review (weekly) untouched

## 1. Unlock progress (activation)
- Segmented 5-step bar on the mentor orb and nudge card, followed by a minimal right-to-left unlock popup that animates the orb's bloom into its activated state. The orb has no completion tick.
- Counted per user: only creating a trade adds a point; edits, copies (same asset/date/direction/entry/qty) and
  delete + re-add never do. Users who already had 5+ trades see no popup. Target = AI_REVIEW_FIRST_TRADES (default 5).

## 2. Reviews
- Date-range only (weekly is a preset): unlock needs >= 5 trades in the range, max 1 review a day and 3 a week.
- Dialog tabs: Review | History. Review is one scrolling report; old weekly reviews stay readable in History.
- Review generation has an animated mentor loader. A review counts against the allowance only after it is saved; failed attempts release their reservation and refresh the displayed allowance.

## Files
New:      backend/src/{models/mentorProgress.models.js, utils/mentorProgress.js, controllers/progress.controller.js, routes/progress.routes.js}
          frontend/src/{services/progressApi.js, hooks/useMentorProgress.js}
          frontend/src/components/rightContainer/journal/{MentorMark.jsx, MentorUnlockBadge.jsx, mentorProgress.css, ReviewReport.jsx}
Modified: backend/src/{app.js, controllers/trade.controller.js, utils/aiQuota.js, routes/aiRangeReview.routes.js}
          frontend/src/components/rightContainer/journal/{MentorOrb, TradeJournal, AiMentorDialog, RangeReviewPanel, ReviewHistoryPanel, reviewParts}.jsx
