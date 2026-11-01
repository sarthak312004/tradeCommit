# The Trading Loop (onboarding)

First-run experience: Strategy → Planner → Journal → AI Mentor, with a return path to Strategy.
Replaces the tooltip-first *welcome* tour for new accounts **only while the rollout switch is on**. The old tour code is untouched.

## Rollout switch (default OFF)
- Build time: `VITE_TRADING_LOOP_ONBOARDING=true` (frontend env). Unset = production behaves exactly as before.
- QA per browser: `localStorage['tradecommit:flag:trading-loop'] = 'on' | 'off'` (overrides the build value).

## Who sees it
Only an account that finishes onboarding **while the switch is on**: `OnboardingPage` calls `queueTradingLoopOnboarding()`,
which sets `tradecommit:loop:<username>` = `pending` and marks the old *main* tour `done`. It no longer queues the journal/planner tours
(an unset status is recorded `done`, an existing one is never overwritten): the loop replaces the whole automatic sequence.
Existing accounts have no `tradecommit:loop:*` key, so nothing ever opens for them. No backend/schema involvement; state is localStorage.

## States (`tradecommit:loop:<username>`)
`pending` auto-opens once · `snoozed` (Close / Esc) shows a "Resume" pill, progress kept · `done` (Skip / Finish / pill ×).
Progress (scene id) is in `tradecommit:loop-step:<username>`.
Replay (profile menu → "The Trading Loop", only while the switch is on) never changes the stored status.

## One guide at a time (guidance controller)
The loop never opens itself: it **asks** `GuidanceProvider` (`context/`, rules in `utils/guidance.js`, tests in `utils/guidance.test.js`) and renders only while granted.
The same controller owns the Playbook and the legacy tours. Rules: one active guide; requests made while one is active are ignored; simultaneous
requests start one (user request first, then priority) and the rest are dropped; after a guide ends, automatic guides wait until the user navigates;
nothing starts while a real form/modal is open and an active guide hides itself (state kept) until it closes. Mark your own modal with
`data-guide-surface` (on its `aria-modal` element) so it is not mistaken for an application form.
The Playbook is reached via the loop's **Playbook** header button (loop pauses, Playbook opens, loop resumes at the same scene; sandbox edits reset).

## Routes
`/trading-loop[?scene=welcome|strategy|planner|journal|mentor|loop]` — signed-in preview, no state read/written, independent of the switch.

## Files
- `TradingLoopExperience.jsx` controller (auto-start, resume pill, replay event, persistence)
- `TradingLoopDialog.jsx` modal shell: Next/Back/Skip/Close, progress, keyboard (←/→/Esc), focus trap, `#root` inert
- `LoopDiagram.jsx` animated nodes + return path (two SVG geometries: wide / phone)
- `LoopScene.jsx`, `LoopNavigation.jsx`, `loopStyles.js` reusable scene + nav pieces
- `scenes.js` all copy; a scene may set `Component` to render custom content. `stages.js` the four stages (no import cycles)
- `useLoopFlow.js`, `useModalA11y.js`, `useReducedMotion.js`, `tradingLoop.css` (scoped under `.tl-root`)
- `../../utils/tradingLoop.js` switch + storage + events · `../../pages/TradingLoopPage.jsx` preview route

## Sandbox (Part 2): `sandbox/`
Interactive scenes: Strategy (pick a setup, tick rules) → Planner (editable sample planner) → Plan vs journal (animated, replayable) → AI Mentor (**DEMO DATA**) → Loop (accepted demo rules appear in a sample strategy).
- State is a `useReducer` inside `SandboxProvider` (mounted by `TradingLoopDialog`). It exists only while the dialog is open.
- Isolation: `sandbox/` imports no service, context, profile hook, `fetch`, or storage. Demo content is the constants in `demoData.js`.
  The mentor feedback is hard-coded and labelled DEMO DATA; no AI request is ever made. Nothing is written to a journal, planner or the database.
- Arrow-key scene navigation is suspended while focus is in an input/textarea/select (Escape still closes).
- Reduced motion: the comparison shows fully, no timers; CSS animations are disabled as before.
