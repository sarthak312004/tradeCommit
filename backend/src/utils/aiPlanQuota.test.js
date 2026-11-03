// Free vs Pro AI caps and gates. Pure rules only (no database): the end-to-end flow lives in aiReviewFlow.test.js.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { ApiError, publicErrorFields } from "./ApiError.js";
import { getEntitlements } from "./entitlements.js";
import { aiContextFor, aiLimits, buildQuota, dailyBudgetFor, poolFilter, resolvePlan, weeklyCap } from "./aiQuotaRules.js";
import { assertEntitled } from "./planLimits.js";

const NOW = Date.parse("2026-11-03T10:00:00.000Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ENV = ["PLAN_ENFORCEMENT", "AI_DAILY_BUDGET", "AI_DAILY_BUDGET_FREE", "AI_DAILY_BUDGET_PRO", "AI_REVIEW_PER_DAY"];
let saved;
beforeEach(() => {
  saved = Object.fromEntries(ENV.map((name) => [name, process.env[name]]));
  for (const name of ENV) delete process.env[name];
  process.env.PLAN_ENFORCEMENT = "all";
});
afterEach(() => {
  for (const name of ENV) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

const freeUser = () => ({ createdAt: new Date("2026-01-01") });
const proUser = () => ({ createdAt: new Date("2026-01-01"), planAccessUntil: new Date(NOW + 30 * DAY) });
const free = () => getEntitlements(freeUser(), NOW);
const pro = () => getEntitlements(proUser(), NOW);
// confirmed reviews, oldest first, each `hoursAgo` hours before NOW
const reviews = (...hoursAgo) => hoursAgo.map((h) => ({ createdAt: new Date(NOW - h * HOUR) }));
const quotaFor = (entitlements, rows) => buildQuota({ rows, now: NOW, perDay: aiLimits().perDay, perWeek: weeklyCap(entitlements) });

// ---- weekly cap comes from the entitlement ------------------------------------------------------------------------

test("weekly cap: free 1, pro 3, from entitlements.aiWeeklyPer7Days", () => {
  assert.equal(weeklyCap(free()), 1);
  assert.equal(weeklyCap(pro()), 3);
  assert.equal(weeklyCap({ aiWeeklyPer7Days: 5 }), 5);
});

test("weekly cap: null is unlimited, an unusable value blocks instead of opening up", () => {
  assert.equal(weeklyCap({ aiWeeklyPer7Days: null }), Infinity);
  for (const bad of [undefined, -1, 1.5, "3", NaN]) assert.equal(weeklyCap({ aiWeeklyPer7Days: bad }), 0);
});

test("without entitlements the rollout mode decides: enforced = free caps, off = pro caps", () => {
  assert.equal(weeklyCap(undefined), 1);
  process.env.PLAN_ENFORCEMENT = "off";
  assert.equal(weeklyCap(undefined), 3);
});

test("the per-day cap is 1 for everyone and does not depend on the plan", () => {
  assert.equal(aiLimits().perDay, 1);
});

// ---- the allowance, free vs pro -----------------------------------------------------------------------------------

test("free: nothing used is not blocked and shows a limit of 1 per 7 days", () => {
  const quota = quotaFor(free(), []);
  assert.equal(quota.blocked, false);
  assert.deepEqual(quota.usage, { day: { used: 0, limit: 1 }, week: { used: 0, limit: 1 } });
});

test("free: one review earlier in the week uses the whole weekly allowance; pro with the same history is open", () => {
  const rows = reviews(3 * 24); // 3 days ago: the daily cap is clear, the weekly one is not for free
  const forFree = quotaFor(free(), rows);
  assert.equal(forFree.blocked, true);
  assert.equal(forFree.reason, "weekly_limit");
  assert.match(forFree.message, /1 review for this 7-day period/);
  assert.equal(forFree.nextAvailableAt, new Date(NOW - 3 * DAY + 7 * DAY).toISOString());

  const forPro = quotaFor(pro(), rows);
  assert.equal(forPro.blocked, false);
  assert.deepEqual(forPro.usage.week, { used: 1, limit: 3 });
});

test("pro: blocked by the 3rd review of the week, and the wait ends when the oldest one leaves the 7 days", () => {
  const rows = reviews(6 * 24, 4 * 24, 2 * 24);
  const quota = quotaFor(pro(), rows);
  assert.equal(quota.blocked, true);
  assert.equal(quota.reason, "weekly_limit");
  assert.match(quota.message, /3 reviews for this 7-day period/);
  assert.equal(quota.nextAvailableAt, new Date(NOW - 6 * DAY + 7 * DAY).toISOString());
  assert.equal(quotaFor(pro(), rows.slice(1)).blocked, false); // two this week: still one left
});

test("a review in the last 24 hours blocks both plans (daily cap), with the daily reason and wait", () => {
  const rows = reviews(2);
  for (const entitlements of [free(), pro()]) {
    const quota = quotaFor(entitlements, rows);
    assert.equal(quota.blocked, true);
  }
  assert.equal(quotaFor(pro(), rows).reason, "daily_limit");
  assert.equal(quotaFor(pro(), rows).nextAvailableAt, new Date(NOW - 2 * HOUR + DAY).toISOString());
  assert.match(quotaFor(pro(), rows).message, /1 review for today/);
  // free hits both caps; the later of the two waits is reported and the reason is the weekly one
  assert.equal(quotaFor(free(), rows).reason, "weekly_limit");
});

test("an unlimited weekly entitlement only ever stops at the daily cap, and reports a null limit", () => {
  const entitlements = { aiWeeklyPer7Days: null };
  const quota = quotaFor(entitlements, reviews(6 * 24, 5 * 24, 4 * 24, 3 * 24, 2 * 24));
  assert.equal(quota.blocked, false);
  assert.equal(quota.usage.week.limit, null);
  assert.equal(quotaFor(entitlements, reviews(1)).reason, "daily_limit");
});

test("a weekly entitlement of 0 blocks cleanly with no wait time instead of crashing", () => {
  const quota = quotaFor({ aiWeeklyPer7Days: 0 }, []);
  assert.equal(quota.blocked, true);
  assert.equal(quota.reason, "weekly_limit");
  assert.equal(quota.nextAvailableAt, null);
});

test("moving the cap in config or an override moves the quota: free user with an override of 2", () => {
  const entitlements = getEntitlements({ ...freeUser(), entitlementOverrides: { aiWeeklyPer7Days: 2 } }, NOW);
  assert.equal(quotaFor(entitlements, reviews(3 * 24)).blocked, false);
  assert.equal(quotaFor(entitlements, reviews(5 * 24, 3 * 24)).blocked, true);
});

// ---- budget pools -----------------------------------------------------------------------------------------------

test("budget pools: defaults keep the old total for pro and give free its own, smaller pool", () => {
  assert.equal(dailyBudgetFor("pro"), 200);
  assert.equal(dailyBudgetFor("free"), 50);
});

test("budget pools follow the environment and are independent of each other", () => {
  process.env.AI_DAILY_BUDGET = "300";
  assert.equal(dailyBudgetFor("pro"), 300); // unchanged meaning of the old variable
  process.env.AI_DAILY_BUDGET_FREE = "20";
  process.env.AI_DAILY_BUDGET_PRO = "120";
  assert.equal(dailyBudgetFor("free"), 20);
  assert.equal(dailyBudgetFor("pro"), 120);
  process.env.AI_DAILY_BUDGET_FREE = "9999"; // however big the free pool is, pro's does not change
  assert.equal(dailyBudgetFor("pro"), 120);
});

test("an unknown plan gets the smallest pool, never a bigger one", () => {
  assert.equal(dailyBudgetFor("enterprise"), 50);
  assert.equal(dailyBudgetFor(undefined), 50);
});

test("a pool counts its own plan's rows plus legacy rows without a plan, and nobody else's", () => {
  assert.deepEqual(poolFilter("free"), { plan: { $in: ["free", null] } });
  assert.deepEqual(poolFilter("pro"), { plan: { $in: ["pro", null] } });
});

test("the plan recorded on a reservation is the caller's, else the one a user without billing data would have", () => {
  assert.equal(resolvePlan("pro"), "pro");
  assert.equal(resolvePlan(undefined), "free"); // enforcement is "all" in these tests
  process.env.PLAN_ENFORCEMENT = "off";
  assert.equal(resolvePlan(undefined), "pro");
});

test("aiContextFor gives a request its entitlements and plan together", () => {
  assert.deepEqual(aiContextFor(freeUser()).plan, "free");
  assert.equal(aiContextFor(freeUser()).entitlements.aiWeeklyPer7Days, 1);
  assert.equal(aiContextFor(proUser()).plan, "pro");
  assert.equal(aiContextFor(proUser()).entitlements.aiWeeklyPer7Days, 3);
});

// ---- feature gates ---------------------------------------------------------------------------------------------

test("date-range reviews and history are locked for free with 403 PLAN_LIMIT and the entitlement key as feature", () => {
  for (const feature of ["aiRangeReviews", "aiHistory"]) {
    assert.throws(
      () => assertEntitled(free(), feature, "Pro only"),
      (error) => error instanceof ApiError && error.statusCode === 403 && error.code === "PLAN_LIMIT" && error.feature === feature
    );
    assert.doesNotThrow(() => assertEntitled(pro(), feature, "Pro only"));
  }
});

test("the error the client receives carries code and feature", () => {
  try {
    assertEntitled(free(), "aiHistory", "Pro only");
    assert.fail("should have thrown");
  } catch (error) {
    assert.deepEqual(publicErrorFields(error), { code: "PLAN_LIMIT", feature: "aiHistory" });
  }
});

test("gates follow the entitlement, so an override or a config change opens them without code changes", () => {
  const entitlements = getEntitlements({ ...freeUser(), entitlementOverrides: { aiRangeReviews: true } }, NOW);
  assert.doesNotThrow(() => assertEntitled(entitlements, "aiRangeReviews", "x"));
  assert.throws(() => assertEntitled(entitlements, "aiHistory", "x"));
});

test("a missing or malformed entitlement locks the feature", () => {
  for (const entitlements of [undefined, null, {}, { aiHistory: "yes" }, { aiHistory: 1 }]) {
    assert.throws(() => assertEntitled(entitlements, "aiHistory", "x"), (error) => error.statusCode === 403);
  }
});

test("carry-forward and the weekly review are not gated: their entitlement is on for free", () => {
  assert.equal(free().aiCarryForward, true);
  assert.equal(weeklyCap(free()) >= 1, true);
});
