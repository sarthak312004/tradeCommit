# Guided onboarding

The existing threaded `GuideSurface` renders two independent walkthroughs:

1. The main PLAN → JOURNAL → FEEDBACK guide explains the trading workflow.
2. The Planner feature walkthrough explains Planner Connection, Deep Mode, Quick Plan, and Full Editor.

Both use real `data-tour` anchors and the same dimmed spotlight/connector design. `GuidanceProvider` ensures they never
overlap.

## Main guide and workflow progress

Main guide step IDs are `planner` → `create-journal` → `journal-context` → `journal-execution` → `ai-mentor`.
`POST /auth/onboarding/complete` initializes main guide state only when `onboardingCompleted` changes from false to true.
`GET /auth/profile` restores it across refresh and login; `PATCH /auth/onboarding/guide` saves modal status and step.
The browser's `localStorage` key `tradecommit:onboarding-guide:v1:<username lowercased>` is retained as a fallback and
for username-rename compatibility.

The header indicator is not driven by modal navigation. Authenticated domain controllers record these saved actions
idempotently on the user's `onboardingGuide` subdocument:

- **PLAN:** save a new PlanEntry and connect a Planner to a journal.
- **JOURNAL:** create a journal, save its context, and log a trade.
- **FEEDBACK:** receive a saved weekly or date-range AI Mentor review.

The backend sets `workflowCompletedAt` once all actions are present. The header indicator is shown only when main
onboarding state exists and is hidden permanently after workflow completion. Existing users with no main state are not
queued. If an older client has a local guide but no server copy, the next authenticated profile load restores it only
for an account with a recorded onboarding trading style and derives existing milestones from saved domain records.
The compact, shadowed workflow badge and segmented bar sit beside the header options without changing header height.
When the server-reported workflow changes from incomplete to complete, a small right-side confirmation appears once
per account completion.
Before completion, deleting the last saved Planner, Journal, context, trade, or Mentor review that supports a milestone
reconciles the action list from remaining records, including whether any Planner remains connected to a journal. After
`workflowCompletedAt` is set, later deletions do not roll it back. The header bar fills linearly by the count of its six
saved-action milestones, independent of their order.

Main-guide anchors: `data-tour="sidebar-planners"`, `data-tour-section="sidebar-journals"`,
`data-tour="journal-context"`, `data-tour="add-trade"`, and `data-tour="mentor-orb"`.

## First Planner feature walkthrough

`User.plannerWalkthrough` is separate from main guide state. The backend queues it only after the authenticated user
creates their first Planner; opening a Planner created before this feature does not trigger it. It is tied to that
Planner's owned ID, resumes after refresh, and is never restarted after `completed` or `skipped`.

The steps and real anchors are:

| Step | Anchor | Explanation |
|---|---|---|
| `connection` | `data-tour="planner-journal"` | Link a journal so the mentor can compare plans with executed trades. |
| `open-plan` | `data-tour="planner-open-plan"` | Click an available calendar date to open the plan editor. |
| `deep-mode` | `data-tour="planner-deep-mode"` | Optional focus workspace and its timer/music controls. |
| `quick-plan` | `data-tour="planner-quick-plan"` | Optional templates, bias and concise planning fields. |
| `full-editor` | `data-tour="planner-full-editor"` | Rich-text editing for longer notes and screenshots. |

When no journal exists, a temporary, non-interactive connection hint provides the real spotlight anchor and explains
that a journal is needed before linking. After Connection, the walkthrough waits at the calendar until the user opens a
plan; it does not open the editor on the user's behalf. The Deep Mode, Quick Plan, and Full Editor steps then appear
inside that opened form. Only this walkthrough is allowed to display above that drawer; the main guide keeps its
normal form-suspension behavior.

`PATCH /auth/onboarding/planner-walkthrough` persists each step/status for the authenticated user and verifies the
Planner belongs to that user. Both onboarding routes derive ownership from `req.user._id`; existing user documents
keep null subdocuments unless a legacy local guide is explicitly restored, and need no migration.
