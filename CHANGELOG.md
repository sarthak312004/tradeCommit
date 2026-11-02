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
