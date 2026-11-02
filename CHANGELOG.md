# Changelog

## Unreleased — Guided onboarding (Part 1)

### Added
- Guided onboarding: one continuous Plan → Journal → AI feedback walkthrough (Planner, create first journal, journal
  context, execution tracking, AI Mentor). Premium card with a thin glowing connector to the real UI, theme-aware dim,
  responsive (card becomes a top/bottom sheet on phones), reduced-motion aware.
- Resumes after refresh; moves on by itself when the first journal is created; skippable; replay from the profile menu.
- Unit tests: `onboardingGuide.test.js` (state, persistence, completion), `guideLayout.test.js` (placement, connector).
- Handoff notes for Part 2 in `frontend/src/components/onboardingGuide/README.md`.

### Changed
- `Home.jsx`, `OnboardingPage.jsx`, `ProfileMenu.jsx` ("Take guided tour"), `SidebarSection.jsx` (anchor),
  `TradeJournal.jsx` (import hint gating), `profileApi.js` (rename carry-over), `utils/guidance.js` + test,
  `utils/Icons.jsx` (`CompassIcon`), `PROJECT_CONTEXT.md`, `GUIDANCE_REPORT.md`.

### Removed
- Legacy Product Tour (`components/tour/*`, `utils/productTour.js`) and unreachable Trading Loop / Playbook / mission
  tracker code that depended on it. Old `tradecommit:tour:*` localStorage keys are simply ignored.

### Compatibility
- No backend, API, route, schema or dependency changes. Existing users are never queued.
