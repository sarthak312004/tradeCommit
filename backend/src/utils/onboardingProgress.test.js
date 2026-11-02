import test from "node:test";
import assert from "node:assert/strict";
import {
  getOnboardingActionsFromFacts,
  hasCompletedOnboardingWorkflow,
  ONBOARDING_ACTION,
  REQUIRED_ONBOARDING_ACTIONS,
} from "./onboardingProgress.js";

test("workflow completion requires each persisted Plan, Planner connection, Journal, trade, and Mentor action", () => {
  assert.equal(hasCompletedOnboardingWorkflow([]), false);
  assert.equal(hasCompletedOnboardingWorkflow(REQUIRED_ONBOARDING_ACTIONS.slice(1)), false);
  assert.equal(
    hasCompletedOnboardingWorkflow(REQUIRED_ONBOARDING_ACTIONS.filter((action) => action !== ONBOARDING_ACTION.PLANNER_CONNECTED)),
    false
  );
  assert.equal(hasCompletedOnboardingWorkflow(REQUIRED_ONBOARDING_ACTIONS), true);
});

test("duplicate saved actions do not prevent workflow completion", () => {
  assert.equal(
    hasCompletedOnboardingWorkflow([...REQUIRED_ONBOARDING_ACTIONS, REQUIRED_ONBOARDING_ACTIONS[0]]),
    true
  );
});

test("reconciled actions reflect remaining saved records after deletions", () => {
  assert.deepEqual(
    getOnboardingActionsFromFacts({ hasJournal: false, hasContext: false, hasPlan: true, hasTrade: false }),
    [ONBOARDING_ACTION.PLAN_CREATED]
  );
  assert.deepEqual(
    getOnboardingActionsFromFacts({ hasJournal: true, hasContext: true, hasPlan: true, hasTrade: true }),
    [
      ONBOARDING_ACTION.PLAN_CREATED,
      ONBOARDING_ACTION.JOURNAL_CREATED,
      ONBOARDING_ACTION.JOURNAL_CONTEXT_SAVED,
      ONBOARDING_ACTION.TRADE_LOGGED,
    ]
  );
  assert.deepEqual(
    getOnboardingActionsFromFacts({ hasPlannerConnection: true }),
    [ONBOARDING_ACTION.PLANNER_CONNECTED]
  );
  assert.deepEqual(
    getOnboardingActionsFromFacts({ hasPlan: true, hasPlannerConnection: true }),
    [ONBOARDING_ACTION.PLAN_CREATED, ONBOARDING_ACTION.PLANNER_CONNECTED]
  );
});
