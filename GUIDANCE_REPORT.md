# TradeCommit guidance

The guided onboarding (`frontend/src/components/onboardingGuide/`: Planner, create journal, journal context, AI Mentor) is the only onboarding guide. It is queued when onboarding is completed and can be replayed from the profile menu. `GuidanceProvider` ensures it does not overlap an application form; its reducer and tests are in `frontend/src/utils/guidance.js` and `frontend/src/utils/guidance.test.js`.

The Trading Loop, Playbook, header mission progress tracker, and mission completion popup have been removed. The Mentor's trade-unlock progress and feedback celebration remain part of the journal experience and are independent of onboarding guidance.
