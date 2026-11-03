// Journal and planner creation limits through the real controllers and a real MongoDB.
// Runs only when TEST_MONGODB_URL points at a disposable MongoDB; otherwise it is skipped.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

const MONGO = process.env.TEST_MONGODB_URL;

describe("journal and planner limits (real database)", { skip: !MONGO && "set TEST_MONGODB_URL to run" }, () => {
  let mongoose, User, Journal, Planner, createJournal, createPlanner;
  let seq = 0;
  let savedEnforcement;

  before(async () => {
    savedEnforcement = process.env.PLAN_ENFORCEMENT;
    process.env.PLAN_ENFORCEMENT = "all";
    ({ default: mongoose } = await import("mongoose"));
    await mongoose.connect(MONGO, { dbName: `tc_limits_${Date.now()}` });
    ({ User } = await import("../models/user.models.js"));
    ({ Journal } = await import("../models/journal.models.js"));
    ({ Planner } = await import("../models/planner.models.js"));
    ({ createJournal } = await import("../controllers/journal.controller.js"));
    ({ createPlanner } = await import("../controllers/planner.controller.js"));
  });

  after(async () => {
    if (savedEnforcement === undefined) delete process.env.PLAN_ENFORCEMENT;
    else process.env.PLAN_ENFORCEMENT = savedEnforcement;
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  const makeUser = (extra = {}) => {
    seq += 1;
    return User.create({ username: `limit_${seq}`, email: `limit${seq}@example.com`, ...extra });
  };

  // calls an asyncHandler-wrapped controller and resolves with { status, body } or { error }
  const run = (handler, user, body) =>
    new Promise((resolve) => {
      const res = {
        status(code) {
          this.code = code;
          return this;
        },
        json(payload) {
          resolve({ status: this.code, body: payload });
          return this;
        },
      };
      handler({ user, body }, res, (error) => resolve({ error }));
    });

  const makeJournal = (user) => run(createJournal, user, { journalName: "Main" });
  const makePlanner = (user) => run(createPlanner, user, { name: "Weekly" });
  const assertBlocked = (result, feature) => {
    assert.equal(result.error?.statusCode, 403);
    assert.equal(result.error.code, "PLAN_LIMIT");
    assert.equal(result.error.feature, feature);
  };

  for (const { label, feature, create, model, seedDoc } of [
    { label: "journals", feature: "maxJournals", create: makeJournal, get model() { return Journal; }, seedDoc: (owner) => ({ journalName: "Seed", owner }) },
    { label: "planners", feature: "maxPlanners", create: makePlanner, get model() { return Planner; }, seedDoc: (owner) => ({ name: "Seed", owner }) },
  ]) {
    test(`${label}: a free user gets one, the second is blocked with PLAN_LIMIT`, async () => {
      const user = await makeUser();
      assert.equal((await create(user)).status, 201);
      assertBlocked(await create(user), feature);
      assert.equal(await model.countDocuments({ owner: user._id }), 1);
    });

    test(`${label}: simultaneous requests never leave a free user with more than one`, async () => {
      const user = await makeUser();
      const results = await Promise.all(Array.from({ length: 5 }, () => create(user)));
      const stored = await model.countDocuments({ owner: user._id });
      assert.ok(stored <= 1, `found ${stored}`);
      assert.equal(results.filter((result) => result.status === 201).length, stored);
      for (const result of results.filter((entry) => entry.error)) assertBlocked(result, feature);
    });

    test(`${label}: users already over the limit keep what they have`, async () => {
      const user = await makeUser();
      await model.create([seedDoc(user._id), seedDoc(user._id), seedDoc(user._id)]);
      assertBlocked(await create(user), feature);
      assert.equal(await model.countDocuments({ owner: user._id }), 3);
    });

    test(`${label}: paid and overridden users get their own limit`, async () => {
      const paid = await makeUser({ planAccessUntil: new Date(Date.now() + 30 * 86_400_000) });
      for (let index = 0; index < 3; index += 1) assert.equal((await create(paid)).status, 201);

      const overridden = await makeUser({ entitlementOverrides: { [feature]: 2 } });
      assert.equal((await create(overridden)).status, 201);
      assert.equal((await create(overridden)).status, 201);
      assertBlocked(await create(overridden), feature);
    });

    test(`${label}: another user's documents do not count`, async () => {
      const first = await makeUser();
      const second = await makeUser();
      assert.equal((await create(first)).status, 201);
      assert.equal((await create(second)).status, 201);
    });
  }
});
