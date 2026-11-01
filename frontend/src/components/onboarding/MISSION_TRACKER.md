# Trading Loop mission tracker (guided activation)

A header-centered, hover-to-open progress guide that walks a new account through the real workflow: **journal → planner → connect planner → first trade → AI feedback**. Its five sky-blue progress blocks fill sequentially as steps are completed, independent of which individual step changed, and disappear when the loop is complete.
Progress starts from live account state and remembers steps already reached, so it remains correct for fresh and long-standing accounts and never decreases if source data is later removed.

## Rollout (default OFF)
- Build: `VITE_MISSION_TRACKER=true`. QA per browser: `localStorage['tradecommit:flag:mission-tracker'] = 'on' | 'off'`.
- Offered automatically only to an account that finishes onboarding while the switch is on (`OnboardingPage` -> `queueMission`).
- Any other account can opt in from the profile menu ("Setup guide"). Existing accounts are never opened into it by themselves.
- Once all five steps are complete, a one-time completion popup appears. Closing it permanently hides the header indicator and profile-menu opt-in.
- With the switch off the component renders no panel and makes no mission-specific API requests or actions. The old GetStarted cards are unchanged.

## State (per account, per browser, localStorage `tradecommit:mission*:<username>`)
status `active | minimized | complete | dismissed`, chosen guide journal, skipped steps (`planner`, `link` only), "opened mentor once", analytics fired. The header guide cannot be dismissed until all five steps are complete; minimizing only closes the popover, not the header progress indicator.
Steps already reached are remembered (`tradecommit:mission-reached:<username>`), so removing a journal or trade cannot make the progress bar go backwards. Closing the completion popup stores `tradecommit:mission-finished:<username>` and marks the mission dismissed. Previously completed trackers receive this popup once.
No backend or schema change.

## Shared guide behavior
`GuidanceProvider` arbitrates this popover against the Trading Loop, Playbook, and legacy spotlight tours. The popover is hidden while another guide or a real application modal is active. When the Trading Loop switch is on, clicking the header progress indicator resumes the loop; hover and keyboard focus continue to show the step details.

## Where each step comes from
| Step | Done when | Real action used |
|---|---|---|
| Journal | `journals.length > 0` | opens the sidebar's own create form (`openCreateForm('journals')`) |
| Planner | `planners.length > 0` | opens the sidebar's own create form |
| Connect | a planner has `linkedJournalId` = the guide journal | `plannerContext.updatePlanner(id, { linkedJournalId })`, only for planners that are not linked yet, only after the user picks one |
| First trade | any journal has a saved trade (pending/failed saves do not count) | selects the guide journal, goes to `/`, and `TradeJournal` opens its own trade form |
| AI feedback | `/progress/mentor` `firstFeedbackReceived`, or a saved review exists, or the mentor was opened after unlocking | `TradeJournal` opens its own AI mentor dialog |

With several journals the guide journal is never chosen for the user: they pick it once (changeable).
Pure logic: `utils/missionSteps.js` (+ `missionSteps.test.js`). Storage, flag, analytics, hand-off: `utils/missionTracker.js`.

## Analytics (existing Vercel Analytics `track`, once per account, no personal data)
`trading_loop_started`, `trading_loop_completed`, `planner_created`, `planner_linked`, `first_trade_logged`, `first_ai_feedback_viewed`.
Step events fire only when a step becomes done while the tracker is open; what already existed is a baseline, not an event.

## Hand-off to the journal page
`requestMissionAction('new-trade' | 'mentor', journalId)` -> `TradeJournal` consumes it (fresh within 8 s, same journal only).

## Rollback
Unset `VITE_MISSION_TRACKER` and redeploy (or set the per-browser override to `off`). Nothing was migrated, so there is nothing to undo.
