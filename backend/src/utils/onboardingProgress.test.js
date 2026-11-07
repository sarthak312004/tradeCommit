import test from "node:test";
import assert from "node:assert/strict";
import {
  createUpdateDemoFlywheelHandler,
  DEMO_FLYWHEEL_STATUSES,
  DEMO_FLYWHEEL_STEPS,
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

const makeDemoDb = (initialDemo = { status: "pending", step: "journal", updatedAt: new Date("2026-11-01T10:00:00Z") }) => {
  const users = new Map([
    ["user-1", { _id: "user-1", demoFlywheel: initialDemo ? { ...initialDemo } : null }],
    ["user-2", { _id: "user-2", demoFlywheel: { status: "pending", step: "journal", updatedAt: new Date("2026-11-01T10:00:00Z") } }],
  ]);

  const User = {
    findOneAndUpdate: async (filter, update) => {
      const doc = users.get(String(filter._id));
      if (!doc || !doc.demoFlywheel) return null;
      const allowed = filter["demoFlywheel.status"]?.$in ?? [];
      if (!allowed.includes(doc.demoFlywheel.status)) return null;
      doc.demoFlywheel = {
        status: update.$set["demoFlywheel.status"],
        step: update.$set["demoFlywheel.step"],
        updatedAt: update.$set["demoFlywheel.updatedAt"],
      };
      return { _id: doc._id, demoFlywheel: { ...doc.demoFlywheel } };
    },
    findById: (id) => ({
      select: async () => {
        const doc = users.get(String(id));
        return doc ? { _id: doc._id, demoFlywheel: doc.demoFlywheel ? { ...doc.demoFlywheel } : null } : null;
      },
    }),
  };

  const handler = createUpdateDemoFlywheelHandler({ User });
  const run = async (body, userId = "user-1") => {
    const out = { status: null, body: null, error: null };
    const res = {
      status(code) { out.status = code; return this; },
      json(payload) { out.body = payload; return this; },
    };
    await handler({ user: { _id: userId }, body }, res, (err) => { out.error = err; });
    return out;
  };

  return { users, run };
};

test("demoFlywheel PATCH validates status and step against strict whitelists and ignores extra fields", async () => {
  const { users, run } = makeDemoDb();

  assert.deepEqual(DEMO_FLYWHEEL_STATUSES, ["pending", "active", "completed", "skipped"]);
  assert.deepEqual(DEMO_FLYWHEEL_STEPS, ["journal", "context", "planner", "ai-mentor", "next-plan", "finish"]);

  for (const badBody of [
    {},
    { status: "in_progress", step: "journal" },
    { status: "active", step: "unknown-step" },
    { status: "", step: "journal" },
    { status: "active", step: "" },
    { status: null, step: "journal" },
  ]) {
    const out = await run(badBody);
    assert.equal(out.error?.statusCode, 400);
  }

  const ok = await run({
    status: "active",
    step: "context",
    extraField: "ignored",
    actions: ["hacked"],
    updatedAt: "1999-01-01T00:00:00Z",
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.demoFlywheel.status, "active");
  assert.equal(ok.body.data.demoFlywheel.step, "context");
  assert.equal("extraField" in users.get("user-1").demoFlywheel, false);
  assert.equal("actions" in users.get("user-1").demoFlywheel, false);
});

test("demoFlywheel PATCH updates only req.user._id regardless of body user identifiers", async () => {
  const { users, run } = makeDemoDb();

  const out = await run(
    { status: "active", step: "planner", _id: "user-2", userId: "user-2", owner: "user-2" },
    "user-1"
  );
  assert.equal(out.status, 200);
  assert.equal(users.get("user-1").demoFlywheel.status, "active");
  assert.equal(users.get("user-1").demoFlywheel.step, "planner");
  assert.equal(users.get("user-2").demoFlywheel.status, "pending");
  assert.equal(users.get("user-2").demoFlywheel.step, "journal");
});

test("demoFlywheel PATCH is idempotent and enforces the forward-only no-regression rule", async () => {
  const { users, run } = makeDemoDb();

  // pending -> active
  let out = await run({ status: "active", step: "context" });
  assert.equal(out.status, 200);
  assert.equal(out.body.data.demoFlywheel.status, "active");
  assert.equal(out.body.data.demoFlywheel.step, "context");

  // active -> pending is rejected by the forward-only filter and returns current active state
  out = await run({ status: "pending", step: "journal" });
  assert.equal(out.status, 200);
  assert.equal(out.body.data.demoFlywheel.status, "active");
  assert.equal(out.body.data.demoFlywheel.step, "context");

  // active -> completed
  out = await run({ status: "completed", step: "finish" });
  assert.equal(out.status, 200);
  assert.equal(out.body.data.demoFlywheel.status, "completed");
  assert.equal(out.body.data.demoFlywheel.step, "finish");

  // completed -> pending / active / skipped are all no-ops (idempotent, never regresses)
  for (const attempt of [
    { status: "pending", step: "journal" },
    { status: "active", step: "planner" },
    { status: "skipped", step: "context" },
    { status: "completed", step: "journal" },
  ]) {
    const res = await run(attempt);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.demoFlywheel.status, "completed");
    assert.equal(res.body.data.demoFlywheel.step, "finish");
    assert.equal(users.get("user-1").demoFlywheel.status, "completed");
    assert.equal(users.get("user-1").demoFlywheel.step, "finish");
  }

  // skipped demo also never regresses to pending, active, or completed
  const skippedDb = makeDemoDb({ status: "skipped", step: "planner", updatedAt: new Date("2026-11-01T10:00:00Z") });
  for (const attempt of [
    { status: "pending", step: "journal" },
    { status: "active", step: "ai-mentor" },
    { status: "completed", step: "finish" },
  ]) {
    const res = await skippedDb.run(attempt);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.demoFlywheel.status, "skipped");
    assert.equal(res.body.data.demoFlywheel.step, "planner");
  }
});

test("existing accounts with demoFlywheel: null keep null and receive 409 on PATCH", async () => {
  const { users, run } = makeDemoDb(null);
  const out = await run({ status: "active", step: "journal" });
  assert.equal(out.error?.statusCode, 409);
  assert.equal(users.get("user-1").demoFlywheel, null);
});
