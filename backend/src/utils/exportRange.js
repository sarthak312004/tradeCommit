import { ApiError } from "./ApiError.js";

// Date presets accepted by GET /journals/:id/export?range=...
// The web app resolves a preset to concrete `from` / `to` dates in the user's own time zone and sends both,
// so those win. The preset is only resolved here (in UTC) when a script calls the API without dates.
export const RANGE_PRESETS = {
  "7d": { label: "Last 7 days", days: 7 },
  "1m": { label: "Last month", months: 1 },
  "3m": { label: "Last 3 months", months: 3 },
  "6m": { label: "Last 6 months", months: 6 },
  "1y": { label: "Last 1 year", months: 12 },
  "2y": { label: "Last 2 years", months: 24 },
  all: { label: "All time" },
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const isRealDateKey = (value) => {
  if (!DATE_KEY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const toKey = (date) => date.toISOString().slice(0, 10);

const monthsBack = (from, months) => {
  const target = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(from.getUTCDate(), lastDay));
  return target;
};

const cleanKey = (value, name) => {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  if (!isRealDateKey(text)) throw new ApiError(400, `"${name}" must be a valid date in YYYY-MM-DD format`);
  return text;
};

/**
 * @returns {{ preset: string, label: string, from: string|null, to: string|null }}
 *          `from` / `to` are inclusive YYYY-MM-DD keys, `null` meaning "no limit".
 */
export const resolveExportRange = ({ range, from, to } = {}) => {
  const preset = String(range ?? "all").trim().toLowerCase();
  const fromKey = cleanKey(from, "from");
  const toDateKey = cleanKey(to, "to");

  if (fromKey && toDateKey && fromKey > toDateKey) {
    throw new ApiError(400, "The start date must be on or before the end date");
  }

  if (fromKey || toDateKey) {
    const known = RANGE_PRESETS[preset];
    const isPreset = Boolean(known) && preset !== "all";
    const label = isPreset
      ? known.label
      : fromKey && toDateKey ? `${fromKey} to ${toDateKey}` : fromKey ? `From ${fromKey}` : `Until ${toDateKey}`;
    return { preset: isPreset ? preset : "custom", label, from: fromKey, to: toDateKey };
  }

  if (preset === "custom") throw new ApiError(400, "A custom range needs a start and/or end date");

  const known = RANGE_PRESETS[preset];
  if (!known) throw new ApiError(400, `Unknown range "${preset}". Use one of: ${Object.keys(RANGE_PRESETS).join(", ")}, custom`);
  if (preset === "all") return { preset, label: known.label, from: null, to: null };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = known.days ? new Date(today.getTime() - (known.days - 1) * 86_400_000) : monthsBack(today, known.months);
  return { preset, label: known.label, from: toKey(start), to: toKey(today) };
};

/** Mongo condition for a resolved range (trade dates are stored at UTC midnight). */
export const rangeToDateFilter = ({ from, to }) => {
  if (!from && !to) return null;
  const condition = {};
  if (from) condition.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) condition.$lte = new Date(`${to}T23:59:59.999Z`);
  return condition;
};
