# Guided onboarding (Part 1)

One continuous walkthrough of the product loop, **PLAN → JOURNAL → AI FEEDBACK**. A minimal card is tied by a thin,
softly glowing connector to the real component it explains; everything else is dimmed (theme-aware). Replaces the legacy
Product Tour completely.

## States and step IDs

Status (`GUIDE_STATUS`): `pending` (queued at the end of `/onboarding`) → `in_progress` → `completed` | `skipped`.

| # | Step id | Loop stage | Anchor (real UI) | Main button | Completes when |
|---|---|---|---|---|---|
| 1 | `planner` | Plan | `[data-tour="sidebar-planners"]` Planner header (+ button) | Continue | user continues |
| 2 | `create-journal` | Journal | `[data-tour-section="sidebar-journals"]` Journals section + create form | Create journal (opens the sidebar form) | **a saved journal exists** (automatic; then redirects to the journal) |
| 3 | `journal-context` | Journal | `[data-tour="journal-context"]` Context button | Next | user continues |
| 4 | `journal-execution` | Journal | `[data-tour="add-trade"]` Add trade button | Next | user continues |
| 5 | `ai-mentor` | AI feedback | `[data-tour="mentor-orb"]` AI Mentor orb | Start journaling | user finishes → `completed` |

Step 2 is interactive (the highlighted area stays clickable); steps 3 and 4 keep their buttons clickable too (opening
Context or the trade form hides the guide until that form closes, via `GuidanceProvider`); steps 1 and 5 are look-only.

## Completion, resume and safety rules (`utils/onboardingGuide.js`, all unit-tested)

- **Never forces existing users.** Only `OnboardingPage` queues the guide (`queueOnboardingGuide`). Accounts with no saved
  state never see it. A queued guide for an account that already has logged trades completes silently.
- **Refresh / incomplete onboarding:** the step is saved on every change; after a reload the guide resumes at that step.
- **Self-healing:** deleting the journal mid-guide sends it back to `create-journal`; a missing anchor shows the card
  centred (no connector) instead of stranding the user.
- **Skip** (`Skip guide`, `Esc`) is permanent; **replay** = profile menu → "Take guided tour" (`requestGuideReplay`),
  always from step 1 (steps that no longer apply resolve themselves).
- Escape/arrow keys act only when focus is on the card or the page, never inside a form field.

## Persistence

`localStorage` key `tradecommit:onboarding-guide:v1:<username lowercased>` →
`{ v: 1, status, step, updatedAt }`. In-memory fallback when storage is blocked. Renaming the username moves the state
(`moveGuideState`, called by `services/profileApi.js`). Changes fire `window` event `tradecommit:onboarding-guide-change`
(`GUIDE_CHANGE_EVENT`, `detail: { username, state }`).

## Modified components and routes

- New: `components/onboardingGuide/*`, `utils/onboardingGuide.js`, `utils/guideLayout.js` (+ tests).
- `Home.jsx`: mounts `<OnboardingGuide>` (replaces `<ProductTour>`); inside `GuidanceProvider`.
- `pages/OnboardingPage.jsx`: queues the guide. `components/profile/ProfileMenu.jsx`: replay entry + `CompassIcon` (moved to `utils/Icons.jsx`).
- `components/sidebar/SidebarSection.jsx`: `data-tour-section` anchor. `services/profileApi.js`: rename carry-over.
- `components/rightContainer/journal/TradeJournal.jsx`: import hint now keys off `isGuideFinished`.
- `utils/guidance.js` (+ test): registry reduced to `onboarding:guide`.
- **Routes: none added, removed or changed.** The guide navigates to `/` (journal view) for the journal steps.

## Backend assumptions and integration points

- **No backend change.** Uses existing `onboardingCompleted` (`/auth/onboarding/complete`) only as the moment of queueing.
- State is per browser. A new device for a user who is mid-guide will not resume it (acceptable for Part 1).
- Optional server sync for Part 2: add `onboardingGuide: { status, step, updatedAt }` to `User`, return it from
  `GET /auth/profile`, add `PATCH /auth/onboarding/guide` (owner from `req.user`), and mirror writes from `saveGuideState`.

## Part 2: connecting the header progress indicator

`utils/onboardingGuide.js` already exposes everything the indicator needs; no changes to the guide are required.

```js
import { GUIDE_CHANGE_EVENT, getGuideState, getGuideProgress, isGuideRunnable } from '../utils/onboardingGuide'

// subscribe: re-read on GUIDE_CHANGE_EVENT (same tab) and 'storage' (other tabs)
const state = getGuideState(profile.username)   // null for accounts that were never queued: render nothing
const { completed, total, fraction, step } = getGuideProgress(state)  // 0..5
```

- Show the indicator while `isGuideRunnable(state)` (or until completed, per design); `state === null` → hidden.
- Clicking it can call `requestGuideReplay()` to bring the guide back (it restarts from step 1), or add a
  `resumeOnboardingGuide()` that calls `setGuideStep(username, state.step)` and dispatches `GUIDE_REPLAY_EVENT` handling
  that resumes instead of restarting.
- Step ids / order: `GUIDE_STEP`, `GUIDE_STEP_ORDER`, stage mapping `GUIDE_STAGE`.
