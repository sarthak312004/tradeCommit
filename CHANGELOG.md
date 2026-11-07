# Changelog

## Unreleased — Persistent onboarding

### Added
- Account-scoped main onboarding status and real-action milestones for saved plans, journal/context/trade activity, and
  AI Mentor reviews. The segmented header indicator hides after workflow completion.
- A separate first-Planner walkthrough for Journal Connection, Deep Mode, Quick Plan, and Full Editor, with refresh
  recovery and one-time skip/completion.
- Unit tests for workflow milestones, guide state, Planner walkthrough order, and threaded-card layout.

### Changed
- Authenticated profile routes and User subdocuments now persist both onboarding systems; domain controllers record
  genuine user actions idempotently. `GuidanceProvider` arbitrates both walkthroughs.
- Updated `PROJECT_CONTEXT.md` and `frontend/src/components/onboardingGuide/README.md`.

### Compatibility
- Existing accounts without an eligible legacy guide retain null onboarding subdocuments and are not queued or reset.
  No migration or dependency is required; legacy local guide state is restored only when a recorded onboarding trading
  style identifies a new-user account. All writes are scoped to the authenticated user.

## Free / Pro downgrade safety and rollout

- Existing over-limit journals and planners remain readable/exportable; the oldest within each entitlement remain writable and later resources are marked `readOnly` in list responses.
- Server-side trade, journal, planner, plan-entry, and related image mutations are blocked on read-only resources with machine-readable `PLAN_LIMIT` features. Sidebar rows show the upgrade/read-only badge.
- Added dry-run-first, idempotent legacy grandfathering and nightly Dodo subscription reconciliation scripts. Reconciliation no longer stamps `billingLastEventAt` and writes only if billing fields are unchanged since read.
- Import commit now rejects locked (read-only) journals; locked journals/planners disable editing in the main pane, not just the sidebar.
- Added the legacy Pro expiry banner and a manual QA / go-live / rollback checklist in `docs/PLAN_ROLLOUT_QA.md`.
