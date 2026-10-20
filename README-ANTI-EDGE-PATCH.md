# Anti-edge / flywheel feedback, RRR fix, orb dot fix

Drop these files over the project at the same paths (all paths start with `TradeCommit/`). No new dependencies, no DB migration
(reviews are stored as Mixed, and reviews saved earlier keep rendering).

## 1. RRR fixed (AI feedback, PDF, Analysis tab)
`avgRrr` was average R per trade, which is **expectancy in R**, not a reward-to-risk ratio.
- Expectancy (R) = average R per trade.  Reward : risk (RRR) = average winner R / average loser R.
- Analysis tab: "Avg RRR" tile replaced by **Reward : risk**; the Expectancy tile shows its R value in the hint; a new **Expectancy (R)** row sits under Performance.
- Review header tiles and the PDF now say **Expectancy** and **Reward : risk**. Reviews saved before this only hold `avgRrr`, so they show it as Expectancy.
- The AI prompt gets both numbers with explicit labels and is told never to call expectancy an RRR.
- Stats payload: `{ trades, closed, netPnl, winRate, expectancyR, rewardRisk, payoffRatio, avgRrr }` (`avgRrr` is a legacy alias of `expectancyR`).

## 2. Orb dot no longer clipped
The "feedback is ready" dot lived inside the `overflow-hidden rounded-full` button, so the circle cut its top-right. It is now a sibling of the button, on the disc's rim (`MentorOrb.jsx`).

## 3. Anti-edge feedback that turns the flywheel
Plan -> Execute -> Record -> Review -> Refine. The review is now built around closing that loop, using planner + journal + strategy together.
New `flywheel` block in every new review (UI section "Close the loop"):
- **Weakest link** in the loop (plan / execute / record / review), chosen from evidence.
- **What your last review asked for** - kept / partly / not / can't tell, judged from this period's trades. Loaded by `utils/flywheel.js` from the previous saved review (weekly or range).
- **Where your edge leaks** - up to 3 anti-edge patterns ranked by measured cost, with trades.
- **What the numbers can and can't tell you** - confidence capped by sample size on the server (under 30 closed = "early", 30-99 = "building", 100+ = "solid"); the prompt receives a 95% win-rate range.
- **Carry this into your next plan** - ONE rule, one line to write in the plan, one countable checkpoint. The first next-step is the same change.

Computed facts given to the model (`computeLeakEvidence` in `tradeStats.js`): re-entry sequences after a same-day loss (with entry counts, so limits can be checked), trades after a same-day loss, results with each checkbox ticked vs not, risk spread, plan-day vs no-plan-day results, and whether the trades look backfilled (many trades, one date).

Anti-overreach rules added to the prompt and enforced in code:
- discipline score is computed from rule checks (followed / (followed + broken)); the model's number is ignored
- no "edge is clear/proven" below 100 closed trades; confidence capped server-side
- no emotion words (FOMO, revenge) unless the trader's own notes use them
- exact -1R stops are not called proof of discipline
- backfilled-looking logs: no market-phase or live-psychology claims
- 1 to 3 trades is an observation, not a pattern
- every count must match the trades listed; trade chips now carry the T-number ("T14 · 2026-10-20 TECHM long") so lists reconcile
- a proposed limit must be checked against the sequence it is meant to stop

## 4. Planner link
New route `GET /api/v1/journals/:journalId/ai-range-reviews/carry-forward` -> `{ commitment: { start, end, rule, planLine, checkpoint, source } | null }` (never calls the AI).
The plan form in a planner that is linked to a journal shows it as "From your last mentor review" when writing a new plan.

## Routes (unchanged except the one added)
- GET  /api/v1/journals/:journalId/ai-range-reviews                history
- GET  /api/v1/journals/:journalId/ai-range-reviews/preview        saved review + numbers + access
- GET  /api/v1/journals/:journalId/ai-range-reviews/carry-forward  NEW
- POST /api/v1/journals/:journalId/ai-range-reviews                create
- GET  /api/v1/journals/:journalId/ai-range-reviews/:reviewId      open one
- GET/POST /api/v1/journals/:journalId/ai-review (+ /quota)        weekly, unchanged routes

## Files
New:      backend/src/utils/flywheel.js
Modified: backend/src/{utils/{tradeStats,aiMentorPrompt,aiRangePrompt}.js, controllers/{aiReview,aiRangeReview}.controller.js, routes/aiRangeReview.routes.js}
          frontend/src/{utils/{tradeAnalytics,reviewSpeech}.js, services/aiRangeReviewApi.js, pages/PlannerPage.jsx}
          frontend/src/components/rightContainer/{journal/{MentorOrb,ReviewReport,reviewParts,ReviewDownloadButton,TradeAnalysis}.jsx, planner/PlanForm.jsx}

Run `npm run build` in `frontend/` after copying. Old reviews keep working; regenerate a review to get the new "Close the loop" section.
