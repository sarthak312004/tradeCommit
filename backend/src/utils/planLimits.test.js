import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { ApiError, publicErrorFields } from "./ApiError.js";
import { createWithinPlanLimit, planLimitError } from "./planLimits.js";

const DAY = 86_400_000;
let savedEnforcement;
beforeEach(() => {
  savedEnforcement = process.env.PLAN_ENFORCEMENT;
  process.env.PLAN_ENFORCEMENT = "all";
});
afterEach(() => {
  if (savedEnforcement === undefined) delete process.env.PLAN_ENFORCEMENT;
  else process.env.PLAN_ENFORCEMENT = savedEnforcement;
});

const freeUser = () => ({ createdAt: new Date("2026-01-01") });
const proUser = () => ({ createdAt: new Date("2026-01-01"), planAccessUntil: new Date(Date.now() + 30 * DAY) });

// An in-memory stand-in for a collection. Every operation yields to the event loop, so concurrent callers interleave.
const makeStore = ({ seed = 0, jitter = () => 0 } = {}) => {
  const docs = Array.from({ length: seed }, (_, index) => ({ id: `seed${index}` }));
  const store = { docs, created: 0, removed: [], countCalls: 0 };
  const pause = () => new Promise((resolve) => setTimeout(resolve, jitter()));
  let nextId = 0;
  store.countOwned = async () => {
    store.countCalls += 1;
    await pause();
    return docs.length;
  };
  store.create = async () => {
    await pause();
    const doc = { id: `new${nextId++}` };
    docs.push(doc);
    store.created += 1;
    return doc;
  };
  store.remove = async (doc) => {
    await pause();
    docs.splice(docs.indexOf(doc), 1);
    store.removed.push(doc.id);
  };
  return store;
};

const attempt = (store, user, limitKey = "maxJournals") =>
  createWithinPlanLimit({ user, limitKey, noun: "journal", countOwned: store.countOwned, create: store.create, remove: store.remove });

const assertPlanLimit = (error, feature = "maxJournals") => {
  assert.ok(error instanceof ApiError, "expected an ApiError");
  assert.equal(error.statusCode, 403);
  assert.equal(error.code, "PLAN_LIMIT");
  assert.equal(error.feature, feature);
  assert.equal(error.success, false);
  return true;
};

test("a user under the limit can create, and the document comes back", async () => {
  const store = makeStore();
  const doc = await attempt(store, freeUser());
  assert.equal(doc.id, "new0");
  assert.equal(store.docs.length, 1);
});

test("a user at the limit gets 403 PLAN_LIMIT and nothing is created", async () => {
  const store = makeStore({ seed: 1 });
  await assert.rejects(attempt(store, freeUser()), assertPlanLimit);
  assert.equal(store.created, 0);
  assert.equal(store.docs.length, 1);
});

test("the error names the entitlement key and states the limit in its message", async () => {
  const store = makeStore({ seed: 1 });
  await assert.rejects(attempt(store, freeUser()), (error) => {
    assertPlanLimit(error);
    assert.match(error.message, /1 journal\./);
    return true;
  });
  const planners = makeStore({ seed: 1 });
  await assert.rejects(attempt(planners, freeUser(), "maxPlanners"), (error) => assertPlanLimit(error, "maxPlanners"));
});

test("the limit comes from entitlements: a user override raises it", async () => {
  const user = { ...freeUser(), entitlementOverrides: { maxJournals: 2 } };
  const store = makeStore({ seed: 1 });
  await attempt(store, user);
  assert.equal(store.docs.length, 2);
  await assert.rejects(attempt(store, user), (error) => assertPlanLimit(error));
  assert.equal(store.docs.length, 2);
});

test("a limit of 0 blocks every creation", async () => {
  const store = makeStore();
  await assert.rejects(attempt(store, { ...freeUser(), entitlementOverrides: { maxJournals: 0 } }), (error) => assertPlanLimit(error));
  assert.equal(store.created, 0);
});

test("unlimited (null) skips counting entirely", async () => {
  const store = makeStore({ seed: 25 });
  await attempt(store, proUser());
  assert.equal(store.docs.length, 26);
  assert.equal(store.countCalls, 0);
});

test("with enforcement off nobody is limited", async () => {
  process.env.PLAN_ENFORCEMENT = "off";
  const store = makeStore({ seed: 5 });
  await attempt(store, freeUser());
  assert.equal(store.docs.length, 6);
});

test("users already over the limit keep everything they have; only new creation is blocked", async () => {
  const store = makeStore({ seed: 3 });
  await assert.rejects(attempt(store, freeUser()), (error) => assertPlanLimit(error));
  assert.equal(store.docs.length, 3);
  assert.deepEqual(store.removed, []);
});

test("sequential requests: the second is blocked at the first count", async () => {
  const store = makeStore();
  await attempt(store, freeUser());
  await assert.rejects(attempt(store, freeUser()), (error) => assertPlanLimit(error));
  assert.equal(store.docs.length, 1);
  assert.equal(store.created, 1);
});

test("simultaneous requests never leave the user over the limit", async () => {
  const store = makeStore();
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => attempt(store, freeUser())));
  assert.ok(store.docs.length <= 1, `found ${store.docs.length} documents`);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  assert.equal(fulfilled.length, store.docs.length);
  for (const result of results.filter((entry) => entry.status === "rejected")) assertPlanLimit(result.reason);
});

test("randomised interleavings keep the invariant: never above the limit, and every success still exists", async () => {
  let seed = 12345;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let round = 0; round < 60; round += 1) {
    const limit = 1 + Math.floor(random() * 3);
    const existing = Math.floor(random() * limit); // always below the limit so creation is possible
    const store = makeStore({ seed: existing, jitter: () => Math.floor(random() * 3) });
    const user = { ...freeUser(), entitlementOverrides: { maxJournals: limit } };
    const results = await Promise.allSettled(Array.from({ length: 2 + Math.floor(random() * 4) }, () => attempt(store, user)));

    assert.ok(store.docs.length <= limit, `round ${round}: ${store.docs.length} documents with limit ${limit}`);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, store.docs.length - existing, `round ${round}`);
    for (const result of results.filter((entry) => entry.status === "rejected")) assertPlanLimit(result.reason);
  }
});

test("a request that loses the race removes only its own new document", async () => {
  const store = makeStore({ seed: 0 });
  const winner = await attempt(store, freeUser());
  // someone else's request slipped in after the first count: simulate by making the pre-check see an empty collection
  const racing = createWithinPlanLimit({
    user: freeUser(),
    limitKey: "maxJournals",
    noun: "journal",
    countOwned: (() => {
      let calls = 0;
      return async () => (calls++ === 0 ? 0 : store.docs.length);
    })(),
    create: store.create,
    remove: store.remove,
  });
  await assert.rejects(racing, (error) => assertPlanLimit(error));
  assert.deepEqual(store.docs.map((doc) => doc.id), [winner.id]);
  assert.deepEqual(store.removed, ["new1"]);
});

test("if the rollback itself fails, that failure is reported instead of hiding it", async () => {
  const store = makeStore();
  const boom = new Error("database unavailable");
  const racing = createWithinPlanLimit({
    user: freeUser(),
    limitKey: "maxJournals",
    noun: "journal",
    countOwned: (() => {
      let calls = 0;
      return async () => (calls++ === 0 ? 0 : 2);
    })(),
    create: store.create,
    remove: async () => {
      throw boom;
    },
  });
  await assert.rejects(racing, (error) => error === boom);
});

test("planLimitError singular and plural wording", () => {
  assert.match(planLimitError("maxPlanners", 1, "planner").message, /1 planner\./);
  assert.match(planLimitError("maxPlanners", 3, "planner").message, /3 planners\./);
});

test("ApiError without the new options looks exactly as before", () => {
  const error = new ApiError(400, "Bad input", ["x"]);
  assert.equal(error.statusCode, 400);
  assert.equal(error.message, "Bad input");
  assert.deepEqual(error.errors, ["x"]);
  assert.equal(error.success, false);
  assert.equal(error.data, null);
  assert.equal("code" in error, false);
  assert.equal("feature" in error, false);
  assert.deepEqual(publicErrorFields(error), {});
  const defaults = new ApiError(500);
  assert.equal(defaults.message, "Something went wrong");
  assert.deepEqual(defaults.errors, []);
});

test("ApiError carries code and feature when given, and keeps a custom stack", () => {
  const error = new ApiError(403, "Nope", [], "custom stack", { code: "PLAN_LIMIT", feature: "maxJournals" });
  assert.equal(error.code, "PLAN_LIMIT");
  assert.equal(error.feature, "maxJournals");
  assert.equal(error.stack, "custom stack");
  assert.deepEqual(publicErrorFields(error), { code: "PLAN_LIMIT", feature: "maxJournals" });
  assert.equal(new ApiError(403, "x", [], "", null).code, undefined);
});

test("only deliberate ApiErrors with string values reach the client", () => {
  assert.deepEqual(publicErrorFields(Object.assign(new Error("dup"), { code: 11000 })), {}); // database error
  assert.deepEqual(publicErrorFields(Object.assign(new Error("net"), { code: "ECONNRESET" })), {}); // not an ApiError
  assert.deepEqual(publicErrorFields(new ApiError(403, "x", [], "", { code: 7, feature: { a: 1 } })), {});
  assert.deepEqual(publicErrorFields(new ApiError(403, "x", [], "", { code: "PLAN_LIMIT" })), { code: "PLAN_LIMIT" });
  assert.deepEqual(publicErrorFields(null), {});
  assert.deepEqual(publicErrorFields(undefined), {});
});
