import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { GRACE_DAYS, METRIC_TIERS, PLANS } from "../config/plans.config.js";
import { canViewMetric, getEffectivePlan, getEntitlements, planState } from "./entitlements.js";

const DAY = 86_400_000;
const GRACE_MS = GRACE_DAYS * DAY;
const NOW = Date.parse("2026-11-03T12:00:00.000Z");
const at = (offsetMs) => new Date(NOW + offsetMs);

const ENV_KEYS = ["PLAN_ENFORCEMENT", "PLAN_ENFORCEMENT_FROM", "PLAN_OVERRIDES_JSON"];
let savedEnv;
beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.PLAN_ENFORCEMENT = "all"; // most tests are about the billing rule itself
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

const limitsOf = ({ metricAccess, ...limits }) => limits; // eslint-disable-line no-unused-vars
const freeLimits = () => ({ ...PLANS.free });
const proLimits = () => ({ ...PLANS.pro });

test("a user with no billing fields is on the free plan", () => {
  const user = { createdAt: at(-DAY) };
  assert.equal(getEffectivePlan(user, NOW), "free");
  assert.deepEqual(limitsOf(getEntitlements(user, NOW)), freeLimits());
});

test("an active subscription is pro until planAccessUntil", () => {
  const user = { planStatus: "active", planInterval: "monthly", planAccessUntil: at(10 * DAY) };
  assert.equal(getEffectivePlan(user, NOW), "pro");
  assert.deepEqual(limitsOf(getEntitlements(user, NOW)), proLimits());
});

test("a cancelling subscription keeps pro until planAccessUntil, then drops to free after the grace", () => {
  const user = { planStatus: "cancelling", cancelAtPeriodEnd: true, planAccessUntil: at(5 * DAY) };
  assert.equal(getEffectivePlan(user, NOW), "pro");
  assert.equal(getEffectivePlan(user, NOW + 5 * DAY - 1), "pro");
  assert.equal(getEffectivePlan(user, NOW + 5 * DAY + GRACE_MS - 1), "pro");
  assert.equal(getEffectivePlan(user, NOW + 5 * DAY + GRACE_MS), "free");
  assert.deepEqual(limitsOf(getEntitlements(user, NOW + 6 * DAY + GRACE_MS)), freeLimits());
});

test("past_due keeps pro inside the grace window only", () => {
  const inside = { planStatus: "past_due", planAccessUntil: at(-GRACE_MS + 60_000) };
  const outside = { planStatus: "past_due", planAccessUntil: at(-GRACE_MS - 60_000) };
  const exactEdge = { planStatus: "past_due", planAccessUntil: at(-GRACE_MS) };
  assert.equal(getEffectivePlan(inside, NOW), "pro");
  assert.equal(getEffectivePlan(outside, NOW), "free");
  assert.equal(getEffectivePlan(exactEdge, NOW), "free"); // now < until + grace is strict
});

test("an expired subscription is free", () => {
  const user = { planStatus: "expired", planInterval: "yearly", planAccessUntil: at(-30 * DAY) };
  assert.equal(getEffectivePlan(user, NOW), "free");
  assert.deepEqual(limitsOf(getEntitlements(user, NOW)), freeLimits());
});

test("legacyProUntil grants pro without a subscription, and stops exactly when it lapses (no grace)", () => {
  assert.equal(getEffectivePlan({ legacyProUntil: at(DAY) }, NOW), "pro");
  assert.equal(getEffectivePlan({ legacyProUntil: at(1) }, NOW), "pro");
  assert.equal(getEffectivePlan({ legacyProUntil: at(0) }, NOW), "free");
  assert.equal(getEffectivePlan({ legacyProUntil: at(-DAY) }, NOW), "free");
});

test("either source of access is enough", () => {
  const user = { planAccessUntil: at(-30 * DAY), legacyProUntil: at(DAY) };
  assert.equal(getEffectivePlan(user, NOW), "pro");
});

test("enforcement off: everyone, even a brand-new unpaid user, gets pro entitlements", () => {
  process.env.PLAN_ENFORCEMENT = "off";
  assert.equal(getEffectivePlan({ createdAt: at(-DAY) }, NOW), "pro");
  assert.deepEqual(limitsOf(getEntitlements({ createdAt: at(-DAY) }, NOW)), proLimits());
  assert.equal(getEffectivePlan({ planStatus: "expired", planAccessUntil: at(-90 * DAY) }, NOW), "pro");
});

test("enforcement defaults to off when unset or unrecognised", () => {
  delete process.env.PLAN_ENFORCEMENT;
  assert.equal(getEffectivePlan({}, NOW), "pro");
  for (const garbage of ["", "on", "ALL ", "true"]) {
    process.env.PLAN_ENFORCEMENT = garbage;
    // "ALL " is trimmed and lower-cased, so it is a valid mode; the rest fall back to off
    assert.equal(getEffectivePlan({}, NOW), garbage === "ALL " ? "free" : "pro", `PLAN_ENFORCEMENT=${JSON.stringify(garbage)}`);
  }
});

test("enforcement new: only users created after PLAN_ENFORCEMENT_FROM are limited", () => {
  process.env.PLAN_ENFORCEMENT = "new";
  process.env.PLAN_ENFORCEMENT_FROM = "2026-11-01T00:00:00.000Z";
  const before = { createdAt: new Date("2026-10-31T23:59:59.999Z") };
  const after = { createdAt: new Date("2026-11-01T00:00:00.001Z") };
  const exactly = { createdAt: new Date("2026-11-01T00:00:00.000Z") };
  assert.equal(getEffectivePlan(before, NOW), "pro");
  assert.equal(getEffectivePlan(exactly, NOW), "pro");
  assert.equal(getEffectivePlan(after, NOW), "free");
  // a new user who pays is pro like anyone else
  assert.equal(getEffectivePlan({ ...after, planAccessUntil: at(DAY) }, NOW), "pro");
});

test("enforcement new fails open: a missing date setting or missing createdAt never limits anyone", () => {
  process.env.PLAN_ENFORCEMENT = "new";
  assert.equal(getEffectivePlan({ createdAt: at(-DAY) }, NOW), "pro"); // no PLAN_ENFORCEMENT_FROM
  process.env.PLAN_ENFORCEMENT_FROM = "not a date";
  assert.equal(getEffectivePlan({ createdAt: at(-DAY) }, NOW), "pro");
  process.env.PLAN_ENFORCEMENT_FROM = "2026-11-01T00:00:00.000Z";
  assert.equal(getEffectivePlan({}, NOW), "pro"); // no createdAt
});

test("enforcement all: every unpaid user is free, old or new", () => {
  assert.equal(getEffectivePlan({ createdAt: new Date("2020-01-01") }, NOW), "free");
  assert.equal(getEffectivePlan({ createdAt: at(-DAY) }, NOW), "free");
});

test("missing, null or malformed fields mean free", () => {
  for (const user of [undefined, null, {}, { planAccessUntil: null, legacyProUntil: null }, { planAccessUntil: "garbage" }, { planAccessUntil: true }, { legacyProUntil: {} }]) {
    assert.equal(getEffectivePlan(user, NOW), "free", JSON.stringify(user));
    assert.deepEqual(limitsOf(getEntitlements(user, NOW)), freeLimits());
  }
});

test("dates may be Date objects, ISO strings or timestamps", () => {
  assert.equal(getEffectivePlan({ planAccessUntil: at(DAY).toISOString() }, NOW), "pro");
  assert.equal(getEffectivePlan({ planAccessUntil: NOW + DAY }, NOW), "pro");
  assert.equal(getEffectivePlan({ planAccessUntil: at(DAY) }, new Date(NOW)), "pro");
});

test("env PLAN_OVERRIDES_JSON changes only the plan it names", () => {
  process.env.PLAN_OVERRIDES_JSON = JSON.stringify({ free: { maxJournals: 2, exportDays: null }, pro: { aiWeeklyPer7Days: 5 } });
  const free = getEntitlements({}, NOW);
  assert.equal(free.maxJournals, 2);
  assert.equal(free.exportDays, null);
  assert.equal(free.maxPlanners, PLANS.free.maxPlanners);
  assert.equal(free.aiWeeklyPer7Days, PLANS.free.aiWeeklyPer7Days);

  const pro = getEntitlements({ planAccessUntil: at(DAY) }, NOW);
  assert.equal(pro.aiWeeklyPer7Days, 5);
  assert.equal(pro.maxJournals, PLANS.pro.maxJournals);
});

test("env overrides can move a metric and are picked up when the variable changes", () => {
  process.env.PLAN_OVERRIDES_JSON = JSON.stringify({ free: { metricAccess: { dayOfWeek: true, winRate: false } } });
  const first = getEntitlements({}, NOW);
  assert.equal(first.metricAccess.dayOfWeek, true);
  assert.equal(first.metricAccess.winRate, false);
  process.env.PLAN_OVERRIDES_JSON = JSON.stringify({ free: { metricAccess: { dayOfWeek: false } } });
  const second = getEntitlements({}, NOW);
  assert.equal(second.metricAccess.dayOfWeek, false);
  assert.equal(second.metricAccess.winRate, true);
});

test("bad env overrides are ignored: broken JSON, wrong shapes, unknown keys, invalid values", () => {
  const expected = { ...freeLimits() };
  for (const raw of ["{not json", "[]", "null", "42", JSON.stringify({ free: "x" })]) {
    process.env.PLAN_OVERRIDES_JSON = raw;
    assert.deepEqual(limitsOf(getEntitlements({}, NOW)), expected, raw);
  }
  process.env.PLAN_OVERRIDES_JSON = JSON.stringify({
    free: { maxJournals: -1, maxPlanners: 1.5, analytics: "gold", aiRangeReviews: "yes", exportDays: "30", importMaxPerCommit: undefined, madeUp: 7 },
  });
  const result = getEntitlements({}, NOW);
  assert.deepEqual(limitsOf(result), expected);
  assert.equal("madeUp" in result, false);
});

test("per-user overrides apply on top of the plan and the env overrides", () => {
  process.env.PLAN_OVERRIDES_JSON = JSON.stringify({ free: { maxJournals: 2, aiRangeReviews: true } });
  const user = { entitlementOverrides: { maxJournals: 5, aiHistory: true, analytics: "full" } };
  const result = getEntitlements(user, NOW);
  assert.equal(result.maxJournals, 5); // user beats env
  assert.equal(result.aiRangeReviews, true); // env still applies where the user sets nothing
  assert.equal(result.aiHistory, true);
  assert.equal(result.analytics, "full");
  assert.equal(result.maxPlanners, PLANS.free.maxPlanners);
});

test("per-user overrides can unlock or lock a single metric", () => {
  const unlocked = getEntitlements({ entitlementOverrides: { metricAccess: { dayOfWeek: true } } }, NOW);
  assert.equal(unlocked.metricAccess.dayOfWeek, true);
  assert.equal(unlocked.metricAccess.timeOfDay, false);
  const locked = getEntitlements({ planAccessUntil: at(DAY), entitlementOverrides: { metricAccess: { winRate: false } } }, NOW);
  assert.equal(locked.metricAccess.winRate, false);
  assert.equal(locked.metricAccess.dayOfWeek, true);
});

test("invalid per-user overrides are ignored", () => {
  for (const overrides of [null, "x", [], 5, { maxJournals: "9" }, { analytics: "enterprise" }, { deepMode: 1 }, { unknownKey: true }, { metricAccess: "all" }, { metricAccess: { dayOfWeek: "yes" } }]) {
    const result = getEntitlements({ entitlementOverrides: overrides }, NOW);
    assert.deepEqual(limitsOf(result), freeLimits(), JSON.stringify(overrides));
    assert.equal(result.metricAccess.dayOfWeek, false);
  }
});

test("override keys cannot pollute prototypes", () => {
  const evil = JSON.parse('{"metricAccess":{"__proto__":{"polluted":true},"constructor":true},"__proto__":{"polluted":true}}');
  getEntitlements({ entitlementOverrides: evil }, NOW);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.hasOwn(getEntitlements({ entitlementOverrides: evil }, NOW).metricAccess, "constructor"), false);
});

test("a null override means unlimited and survives validation", () => {
  assert.equal(getEntitlements({ entitlementOverrides: { maxJournals: null } }, NOW).maxJournals, null);
});

test("metricAccess for a free user: free metrics open, pro metrics locked", () => {
  const { metricAccess } = getEntitlements({}, NOW);
  for (const [id, tier] of Object.entries(METRIC_TIERS)) {
    assert.equal(metricAccess[id], tier === "free", id);
  }
  for (const id of ["totalTrades", "winRate", "netPnl", "winsLosses", "avgWinLoss", "bestWorstTrade", "avgRiskReward", "equityCurve", "monthlyPnl", "longShort"]) {
    assert.equal(metricAccess[id], true, id);
  }
  assert.equal(metricAccess.profitFactor, false);
  assert.equal(metricAccess.analyticsFilters, false);
});

test("metricAccess for a pro user: every listed metric is open", () => {
  const { metricAccess } = getEntitlements({ planAccessUntil: at(DAY) }, NOW);
  assert.deepEqual(Object.keys(metricAccess).sort(), Object.keys(METRIC_TIERS).sort());
  assert.ok(Object.values(metricAccess).every((allowed) => allowed === true));
});

test("an unknown metric is never allowed", () => {
  const free = getEntitlements({}, NOW);
  const pro = getEntitlements({ planAccessUntil: at(DAY) }, NOW);
  for (const entitlements of [free, pro]) {
    assert.equal(canViewMetric(entitlements, "notAMetric"), false);
    assert.equal(canViewMetric(entitlements, undefined), false);
  }
  assert.equal(canViewMetric(free, "winRate"), true);
  assert.equal(canViewMetric(free, "profitFactor"), false);
  assert.equal(canViewMetric(undefined, "winRate"), false);
});

test("entitlements are a fresh copy: changing one never changes the plan config or the next call", () => {
  const first = getEntitlements({}, NOW);
  first.maxJournals = 99;
  first.metricAccess.profitFactor = true;
  const second = getEntitlements({}, NOW);
  assert.equal(second.maxJournals, PLANS.free.maxJournals);
  assert.equal(second.metricAccess.profitFactor, false);
  assert.equal(PLANS.free.maxJournals, 1);
});

test("entitlements carry exactly the documented keys", () => {
  assert.deepEqual(Object.keys(getEntitlements({}, NOW)).sort(), [...Object.keys(PLANS.free), "metricAccess"].sort());
  assert.deepEqual(Object.keys(PLANS.free).sort(), Object.keys(PLANS.pro).sort());
});

test("planState summarises billing without exposing ids or overrides", () => {
  const user = {
    planStatus: "cancelling",
    planInterval: "yearly",
    planAccessUntil: at(5 * DAY),
    cancelAtPeriodEnd: true,
    billingCustomerId: "cus_secret",
    billingSubscriptionId: "sub_secret",
    entitlementOverrides: { maxJournals: 9 },
  };
  const state = planState(user, NOW);
  assert.deepEqual(state, {
    plan: "pro",
    status: "cancelling",
    accessUntil: at(5 * DAY).toISOString(),
    cancelAtPeriodEnd: true,
    interval: "yearly",
  });
  assert.equal(JSON.stringify([state, getEntitlements(user, NOW)]).includes("secret"), false);
});

test("planState defaults for a user with nothing set, and ignores unknown values", () => {
  assert.deepEqual(planState({}, NOW), { plan: "free", status: "none", accessUntil: null, cancelAtPeriodEnd: false, interval: null });
  assert.deepEqual(
    planState({ planStatus: "weird", planInterval: "weekly", planAccessUntil: "garbage", cancelAtPeriodEnd: "true" }, NOW),
    { plan: "free", status: "none", accessUntil: null, cancelAtPeriodEnd: false, interval: null }
  );
});

test("planState reports the effective plan, so it follows the enforcement mode", () => {
  process.env.PLAN_ENFORCEMENT = "off";
  assert.equal(planState({}, NOW).plan, "pro");
  assert.equal(planState({}, NOW).status, "none");
});

test("METRIC_TIERS lists every metric id the frontend defines", (t) => {
  const file = fileURLToPath(new URL("../../../frontend/src/config/analyticsAccess.js", import.meta.url));
  if (!existsSync(file)) return t.skip("frontend sources are not next to the backend");
  const source = readFileSync(file, "utf8");
  const block = /export const METRIC_ACCESS = \{([\s\S]*?)\n\}/.exec(source);
  assert.ok(block, "could not find METRIC_ACCESS in analyticsAccess.js");
  const frontendIds = [...block[1].matchAll(/^\s*(\w+):\s*['"]\w+['"]/gm)].map((match) => match[1]);
  assert.ok(frontendIds.length > 0);
  assert.deepEqual(frontendIds.filter((id) => !(id in METRIC_TIERS)), [], "metric ids missing from METRIC_TIERS");
  assert.deepEqual(Object.keys(METRIC_TIERS).filter((id) => !frontendIds.includes(id)), [], "METRIC_TIERS has ids the frontend does not know");
  assert.ok(Object.values(METRIC_TIERS).every((tier) => tier === "free" || tier === "pro"));
});

test("User documents default to free and never serialize billing ids or overrides", async (t) => {
  let User;
  try {
    ({ User } = await import("../models/user.models.js"));
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") return t.skip("backend dependencies are not installed");
    throw error;
  }
  const user = new User({
    username: "plan_user",
    email: "plan@example.com",
    billingCustomerId: "cus_secret",
    billingSubscriptionId: "sub_secret",
    entitlementOverrides: { maxJournals: 9 },
  });
  assert.equal(user.planStatus, "none");
  assert.equal(user.planAccessUntil, null);
  assert.equal(user.cancelAtPeriodEnd, false);
  assert.equal(user.legacyProUntil, null);
  assert.deepEqual(getEntitlements(new User({ username: "fresh_user", email: "fresh@example.com" }), NOW).maxJournals, PLANS.free.maxJournals);

  const json = JSON.parse(JSON.stringify(user));
  for (const hidden of ["billingCustomerId", "billingSubscriptionId", "entitlementOverrides"]) {
    assert.equal(hidden in json, false, hidden);
  }
  assert.equal(JSON.stringify(json).includes("secret"), false);
  assert.equal(json.planStatus, "none");
});
