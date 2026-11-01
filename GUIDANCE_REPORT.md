# TradeCommit: unified guidance system (report)

Frontend only. No backend, API, schema or dependency change.

## Root cause of overlapping guides
Four independent owners each decided for themselves whether to open, using timers and `document.querySelector('[aria-modal]')` polling:
`ProductTour` (main -> journal -> planner), `TradingLoopExperience`, `PlaybookModal` (opened by an event, and automatically after the journal tour), `MissionTracker` (hover panel).
Nothing arbitrated between them. Two polls could both see "no modal" in the same moment and both open. On top of that,
`queueTradingLoopOnboarding()` set journal AND planner tours to `pending`, so the loop was followed by automatic spotlight tours.

## New architecture
- `utils/guidance.js`: pure reducer (the rules). One `active` guide; requests while busy are ignored; simultaneous requests start ONE
  (user request first, then priority loop > main > journal > planner > playbook), the rest are dropped; after a guide ends, automatic
  guides wait until the user navigates; nothing starts while a real form is open and the active guide hides (state kept) until it closes;
  only handoff is user-initiated Loop -> Playbook (loop pauses, resumes at the same scene).
- `context/GuidanceProvider.jsx` (+ `guidanceContext.js`, `hooks/useGuidance.js`): React wrapper, mounted in `Home.jsx`. Detects real forms with one
  debounced MutationObserver (guide surfaces carry `data-guide-surface` / `data-tour-card`).
- Guides now ASK (`request`) and render only while granted; they `release` when done.

## Files changed
New: `utils/guidance.js`, `utils/guidance.test.js`, `context/GuidanceProvider.jsx`, `context/guidanceContext.js`, `hooks/useGuidance.js`
Edited: `Home.jsx`, `components/tradingLoop/TradingLoopExperience.jsx`, `TradingLoopDialog.jsx` (Playbook button, marker), `components/tour/ProductTour.jsx`,
`PlaybookModal.jsx`, `components/onboarding/MissionTracker.jsx`, `pages/TradingLoopPage.jsx`, `utils/tradingLoop.js`; docs: `PROJECT_CONTEXT.md`,
`tradingLoop/README.md`, `onboarding/MISSION_TRACKER.md`. (All under `frontend/src/` except `PROJECT_CONTEXT.md`.)
Old components kept; `ProfileMenu`, `GetStarted`, `OnboardingPage`, `productTour.js` untouched (their events/APIs still work).

## Behaviour changes to be aware of
1. `queueTradingLoopOnboarding` no longer sets journal/planner to `pending` (unset -> `done`; an existing value is never overwritten).
2. With the loop switch ON, legacy tours never start by themselves (still available via "Take the product tour").
3. The Playbook no longer opens automatically after the journal tour. Reachable: loop header button, profile menu, empty-journal link.
4. MissionTracker click (loop switch ON) resumes/opens the loop; hover/focus still shows the step list. Switch OFF: unchanged.
5. A request made while another guide or a real form is open is ignored (not queued). After a guide ends, no automatic guide starts on that
   same route until the user navigates or reloads.
6. Pausing the loop for the Playbook or a form resets its sandbox demo edits (scene is kept).
7. Releasing a guide before the controller grants it cancels its pending request, so a quickly abandoned route cannot open a stale guide.
8. Reached mission steps remain complete if their source data is later removed. A one-time completion popup is arbitrated by the guidance controller and permanently closes the setup guide when dismissed.

## Production compatibility
Loop switch default OFF is unchanged: with it off the loop cannot start and legacy tours behave as before, one at a time. Existing accounts have no
`tradecommit:loop:*` and completed `tradecommit:tour:*` statuses, so nothing is requested. Existing progress keys and username-rename migration untouched.

## Tests
Validation after integration: `npm test` passes (81 tests); ESLint passes for the changed integration files; `npm run build` succeeds
(Vite reports the existing large-chunk advisory). The repository-wide lint command still reports unrelated existing errors in files outside
this integration. Browser/manual verification was not performed.

## Rollback
Revert these files from git (or restore the originals); nothing was migrated. Quick disable without redeploying code: set
`localStorage['tradecommit:flag:trading-loop']='off'` per browser, or unset `VITE_TRADING_LOOP_ONBOARDING` and redeploy.
