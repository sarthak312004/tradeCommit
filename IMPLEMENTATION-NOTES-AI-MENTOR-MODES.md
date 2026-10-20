# TradeCommit AI Mentor reliability + journal modes

## What's changed

- Journals now have `mode: "live" | "backtest"`; old journals default to `live` in the model and serialization layer.
- New journal form lets the user select Live trading or Backtesting.
- Journal Context dialog also lets users change the mode later; saving a mode-only change does not reapply default custom properties to existing trades.
- Existing authenticated journal routes handle the mode without adding a separate endpoint:
  - `POST /api/v1/journals` accepts `{ name, currency, mode }`.
  - `PATCH /api/v1/journals/:journalId` accepts `{ mode }`, or `{ context, mode, applyToExistingTrades }`.
  - `GET /api/v1/journals` includes the `mode` on each journal.
- Weekly AI Mentor and date-range AI Mentor prompts now receive mode-specific guidance. Backtest mode emphasizes historical methodology, sample quality, market-regime coverage and realistic costs; live mode emphasizes actual execution, risk and plan adherence. Neither mode assumes the product is only for swing traders.
- A new `mentorDataQuality.js` utility flags missing checkbox values and possible note/property conflicts without rewriting the underlying data. Backtest batches sharing one recorded date are flagged as potentially batch-imported.
- Chronology-dependent re-entry and after-loss comparisons are suppressed by the existing stats helper when many trades share one date. Prompt facts label those comparisons as unavailable instead of treating the batch date as actual execution order.
- Checkbox performance splits distinguish confirmed yes, confirmed no, and unknown/unrecorded values; unknown values are excluded from yes/no comparisons.
- AI review hashes include journal mode so switching modes marks prior reviews stale and causes regeneration under the new assumptions.
- Added unit tests for mode-specific guidance, batch-date warnings, missing metadata, and contradiction detection.

## Validation performed

- Backend JavaScript syntax checks passed for changed backend files.
- `npm test` in `backend` passed: 3 tests.
- Frontend production build could not be run in this environment because frontend dependencies were not installed; an attempted `npm ci` did not complete. Run `npm ci && npm run build` in `frontend` before deployment.

## Important behavior notes

- Mode affects AI interpretation; it does not rewrite historical trade dates or infer missing chronology.
- Automated note/checkbox contradiction checks are deliberately conservative and only raise warnings. They never modify trade metadata.
- Backtest results are treated as hypotheses until supported by an adequate, representative sample; the AI is instructed not to claim a durable edge from a small sample.
