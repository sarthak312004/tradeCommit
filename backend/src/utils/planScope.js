import { ApiError } from "./ApiError.js";

// A plan entry covers one day (the default, and what every entry saved before scopes existed is) or one week.
export const PLAN_SCOPES = ["day", "week"];
export const DEFAULT_PLAN_SCOPE = "day";

export const isValidPlanDateKey = (date) => {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
};

export const isWeeklyPlanStart = (date) =>
  isValidPlanDateKey(date) && new Date(`${date}T00:00:00.000Z`).getUTCDay() === 1;

const addDays = (date, days) =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);

export const planCoversDate = (entry, date) =>
  entry.scope === "week"
    ? isWeeklyPlanStart(entry.date) && entry.date <= date && date <= addDays(entry.date, 6)
    : entry.date === date;

export const planCoversRange = (entry, start, end) =>
  entry.scope === "week"
    ? isWeeklyPlanStart(entry.date) && entry.date <= end && addDays(entry.date, 6) >= start
    : entry.date >= start && entry.date <= end;

/**
 * `undefined` = not sent, so `fallback` applies (create: "day"; update: the entry's current scope).
 * Anything else must be exactly "day" or "week".
 */
export const parsePlanScope = (value, fallback = DEFAULT_PLAN_SCOPE) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !PLAN_SCOPES.includes(value)) {
    throw new ApiError(400, 'Plan scope must be "day" or "week"');
  }
  return value;
};
