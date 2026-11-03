// Turns a user's billing state into what they may do. Pure: no database, no network, no side effects.
// All numbers and switches come from config/plans.config.js; this file only decides WHICH plan applies
// and merges overrides on top. Everything else reads the returned entitlements, never the plan name.
//
//   effective plan = Pro when PLAN_ENFORCEMENT does not apply to the user,
//                    or before planAccessUntil, or during past_due grace, or before legacyProUntil; otherwise Free.
//   PLAN_ENFORCEMENT   off (default / anything unrecognised): everyone gets Pro entitlements
//                      new: only users created after PLAN_ENFORCEMENT_FROM (ISO date) are enforced
//                      all: every user is enforced
//   PLAN_OVERRIDES_JSON  per-plan overrides, e.g. {"free":{"maxJournals":2},"pro":{"metricAccess":{"dayOfWeek":false}}}
//   user.entitlementOverrides  flat overrides for one user, e.g. {"aiRangeReviews":true}  (server-side only)
// Overrides are validated: unknown keys and wrongly typed values are ignored.
import { GRACE_DAYS, METRIC_TIERS, PLANS } from "../config/plans.config.js";

const DAY_MS = 86_400_000;
const ENFORCEMENT_MODES = ["off", "new", "all"];
const PLAN_STATUSES = ["none", "active", "cancelling", "past_due", "expired"];
const PLAN_INTERVALS = ["monthly", "yearly"];
const ANALYTICS_LEVELS = ["basic", "full"];
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const toMs = (value) => {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return NaN;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
};

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const getEnforcementMode = () => {
  const mode = String(process.env.PLAN_ENFORCEMENT ?? "").trim().toLowerCase();
  return ENFORCEMENT_MODES.includes(mode) ? mode : "off";
};

// Whether plan limits apply to this user at all. Not enforced = Pro entitlements (nothing is taken away).
const isEnforced = (user) => {
  const mode = getEnforcementMode();
  if (mode === "all") return true;
  if (mode === "off") return false;
  const from = toMs(process.env.PLAN_ENFORCEMENT_FROM);
  const created = toMs(user?.createdAt);
  return Number.isFinite(from) && Number.isFinite(created) && created > from;
};

const hasPaidAccess = (user, nowMs) => {
  const accessUntil = toMs(user?.planAccessUntil);
  if (user?.planStatus !== "expired" && Number.isFinite(accessUntil)) {
    if (nowMs < accessUntil) return true;
    if (user?.planStatus === "past_due" && nowMs < accessUntil + GRACE_DAYS * DAY_MS) return true;
  }
  const legacyUntil = toMs(user?.legacyProUntil);
  return Number.isFinite(legacyUntil) && nowMs < legacyUntil;
};

const resolveNow = (now) => {
  const ms = toMs(now);
  return Number.isFinite(ms) ? ms : Date.now();
};

/** "free" | "pro": the plan whose rules apply to this user right now. */
export const getEffectivePlan = (user, now = Date.now()) => {
  if (!isEnforced(user)) return "pro";
  return hasPaidAccess(user, resolveNow(now)) ? "pro" : "free";
};

/** The billing summary the client may see. Never includes billing ids or overrides. */
export const planState = (user, now = Date.now()) => {
  const accessUntil = toMs(user?.planAccessUntil);
  return {
    plan: getEffectivePlan(user, now),
    status: PLAN_STATUSES.includes(user?.planStatus) ? user.planStatus : "none",
    accessUntil: Number.isFinite(accessUntil) ? new Date(accessUntil).toISOString() : null,
    cancelAtPeriodEnd: user?.cancelAtPeriodEnd === true,
    interval: PLAN_INTERVALS.includes(user?.planInterval) ? user.planInterval : null,
  };
};

// ---- overrides ---------------------------------------------------------------------------------------------------

const ENTITLEMENT_KEYS = [...new Set([...Object.keys(PLANS.free), ...Object.keys(PLANS.pro)])];

// A key's kind follows from how it is declared in PLANS, so a new key needs no change here.
const kindOf = (key) => {
  const samples = [PLANS.free[key], PLANS.pro[key]];
  if (samples.some((value) => typeof value === "boolean")) return "boolean";
  if (samples.some((value) => typeof value === "string")) return "string";
  return "limit"; // a non-negative whole number, or null for unlimited
};

const isValidValue = (key, value) => {
  switch (kindOf(key)) {
    case "boolean":
      return typeof value === "boolean";
    case "string":
      return key === "analytics" ? ANALYTICS_LEVELS.includes(value) : typeof value === "string";
    default:
      return value === null || (Number.isInteger(value) && value >= 0);
  }
};

// Keeps only known keys with valid values. metricAccess overrides are { metricId: boolean }.
const sanitizeOverrides = (raw) => {
  const clean = {};
  if (!isPlainObject(raw)) return clean;
  for (const key of ENTITLEMENT_KEYS) {
    if (Object.hasOwn(raw, key) && isValidValue(key, raw[key])) clean[key] = raw[key];
  }
  if (isPlainObject(raw.metricAccess)) {
    const metricAccess = {};
    for (const [id, allowed] of Object.entries(raw.metricAccess)) {
      if (!UNSAFE_KEYS.has(id) && typeof allowed === "boolean") metricAccess[id] = allowed;
    }
    clean.metricAccess = metricAccess;
  }
  return clean;
};

let envCache = { raw: undefined, value: {} };
const envOverridesFor = (plan) => {
  const raw = process.env.PLAN_OVERRIDES_JSON;
  if (raw !== envCache.raw) {
    let value = {};
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (isPlainObject(parsed)) {
        value = { free: sanitizeOverrides(parsed.free), pro: sanitizeOverrides(parsed.pro) };
      }
    } catch {
      value = {}; // bad JSON is ignored; the value itself is never logged
    }
    envCache = { raw, value };
  }
  return envCache.value[plan] ?? {};
};

// ---- public API --------------------------------------------------------------------------------------------------

/**
 * Everything the user may do. `null` limits mean unlimited. Always a fresh object, safe to mutate.
 * Shape: { ...PLANS keys, metricAccess: { [metricId]: boolean } }
 */
export const getEntitlements = (user, now = Date.now()) => {
  const plan = getEffectivePlan(user, now);
  const envOverrides = envOverridesFor(plan);
  const userOverrides = sanitizeOverrides(user?.entitlementOverrides);

  const entitlements = { ...PLANS[plan] };
  for (const layer of [envOverrides, userOverrides]) {
    for (const key of ENTITLEMENT_KEYS) {
      if (Object.hasOwn(layer, key)) entitlements[key] = layer[key];
    }
  }

  const metricAccess = {};
  for (const [metricId, tier] of Object.entries(METRIC_TIERS)) {
    metricAccess[metricId] = tier === "free" || (tier === "pro" && plan === "pro");
  }
  for (const layer of [envOverrides, userOverrides]) Object.assign(metricAccess, layer.metricAccess);

  return { ...entitlements, metricAccess };
};

/** Whether these entitlements let the user see a metric. A metric nobody listed is locked. */
export const canViewMetric = (entitlements, metricId) => entitlements?.metricAccess?.[metricId] === true;
