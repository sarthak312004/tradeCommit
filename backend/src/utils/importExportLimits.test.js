import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { ApiError, publicErrorFields } from "./ApiError.js";
import { getEntitlements } from "./entitlements.js";
import { clampExportRange, resolveExportRange } from "./exportRange.js";
import { assertWithinImportLimit, importLimitError } from "./planLimits.js";

const NOW = Date.parse("2026-11-03T10:00:00.000Z");
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
const proUser = () => ({ createdAt: new Date("2026-01-01"), planAccessUntil: new Date(NOW + 30 * DAY) });

// ---- export clamp -----------------------------------------------------------------------------------------------

// 30 days counting today = 2026-10-05; one day of time-zone slack = 2026-10-04
const WINDOW_START = "2026-10-04";

test("unlimited export (null) leaves every range untouched", () => {
  for (const input of [{ range: "all" }, { range: "2y" }, { from: "2020-01-01", to: "2026-01-01" }]) {
    const resolved = resolveExportRange(input);
    assert.deepEqual(clampExportRange(resolved, null, NOW), { ...resolved, clamped: false });
  }
});

test("an open-ended range (\"all time\") is cut to the window", () => {
  const out = clampExportRange(resolveExportRange({ range: "all" }), 30, NOW);
  assert.deepEqual(out, { preset: "custom", label: `From ${WINDOW_START}`, from: WINDOW_START, to: null, clamped: true });
});

test("a wider client range is cut at the start, the end is kept", () => {
  const out = clampExportRange(resolveExportRange({ from: "2026-01-01", to: "2026-11-02" }), 30, NOW);
  assert.equal(out.from, WINDOW_START);
  assert.equal(out.to, "2026-11-02");
  assert.equal(out.clamped, true);
  assert.equal(out.preset, "custom");
});

test("a range with only an end date gets the window start", () => {
  const out = clampExportRange(resolveExportRange({ to: "2026-10-20" }), 30, NOW);
  assert.deepEqual([out.from, out.to, out.clamped], [WINDOW_START, "2026-10-20", true]);
});

test("a range already inside the window is not changed, including its preset", () => {
  const resolved = resolveExportRange({ range: "7d", from: "2026-10-28", to: "2026-11-03" });
  assert.deepEqual(clampExportRange(resolved, 30, NOW), { ...resolved, clamped: false });
  const edge = resolveExportRange({ from: WINDOW_START, to: "2026-11-03" });
  assert.equal(clampExportRange(edge, 30, NOW).clamped, false);
});

test("preset ranges as the server resolves them: 7d is kept, 1m loses its one extra day, 3m is cut to the window", () => {
  const preset = (name, from) => ({ preset: name, label: name, from, to: "2026-11-03" }); // dates fixed, not read from the clock
  assert.equal(clampExportRange(preset("7d", "2026-10-28"), 30, NOW).clamped, false);
  const month = clampExportRange(preset("1m", "2026-10-03"), 30, NOW);
  assert.deepEqual([month.from, month.clamped], [WINDOW_START, true]);
  assert.equal(clampExportRange(preset("3m", "2026-08-03"), 30, NOW).from, WINDOW_START);
});

test("a range wholly older than the window is replaced by the window, never exported as asked", () => {
  const out = clampExportRange(resolveExportRange({ from: "2024-01-01", to: "2024-12-31" }), 30, NOW);
  assert.deepEqual([out.from, out.to, out.clamped], [WINDOW_START, null, true]);
});

test("a range ending the day before the window starts is still outside it", () => {
  const out = clampExportRange(resolveExportRange({ from: "2026-09-01", to: "2026-10-03" }), 30, NOW);
  assert.deepEqual([out.from, out.to, out.clamped], [WINDOW_START, null, true]);
});

test("a future end date is left alone (nothing exists there to leak)", () => {
  const out = clampExportRange(resolveExportRange({ from: "2026-10-20", to: "2026-12-31" }), 30, NOW);
  assert.equal(out.clamped, false);
  assert.equal(out.to, "2026-12-31");
});

test("the window follows the entitlement value, not 30", () => {
  const out = clampExportRange(resolveExportRange({ range: "all" }), 7, NOW);
  assert.equal(out.from, "2026-10-27"); // 7 days counting today start 10-28; one day of slack = 10-27
});

test("the window ends at the UTC day, so a month boundary is handled", () => {
  const out = clampExportRange(resolveExportRange({ range: "all" }), 30, Date.parse("2026-03-05T23:59:59.000Z"));
  assert.equal(out.from, "2026-02-03"); // 30 days counting 03-05 = 02-04, minus one day of slack
});

test("an entitlement of 0 (or an invalid value) blocks export with PLAN_LIMIT instead of opening it up", () => {
  for (const bad of [0, -5, 1.5, "30", NaN]) {
    assert.throws(
      () => clampExportRange(resolveExportRange({ range: "all" }), bad, NOW),
      (error) => error instanceof ApiError && error.statusCode === 403 && error.code === "PLAN_LIMIT" && error.feature === "exportDays"
    );
  }
});

test("free users get the window, pro users get everything, through real entitlements", () => {
  const wide = resolveExportRange({ range: "all" });
  assert.equal(clampExportRange(wide, getEntitlements(freeUser(), NOW).exportDays, NOW).clamped, true);
  assert.equal(clampExportRange(wide, getEntitlements(proUser(), NOW).exportDays, NOW).clamped, false);
});

// ---- import limit -----------------------------------------------------------------------------------------------

test("import: at or under the limit passes, over it is a 403 PLAN_LIMIT for feature import with the counts", () => {
  const free = getEntitlements(freeUser(), NOW);
  assert.doesNotThrow(() => assertWithinImportLimit(free, 0));
  assert.doesNotThrow(() => assertWithinImportLimit(free, free.importMaxPerCommit));

  assert.throws(
    () => assertWithinImportLimit(free, free.importMaxPerCommit + 1),
    (error) =>
      error instanceof ApiError &&
      error.statusCode === 403 &&
      error.code === "PLAN_LIMIT" &&
      error.feature === "import" &&
      error.limit === free.importMaxPerCommit &&
      error.total === free.importMaxPerCommit + 1
  );
});

test("import: null means unlimited and a missing entitlement never blocks", () => {
  assert.doesNotThrow(() => assertWithinImportLimit(getEntitlements(proUser(), NOW), 100_000));
  assert.doesNotThrow(() => assertWithinImportLimit({ importMaxPerCommit: null }, 5000));
  assert.doesNotThrow(() => assertWithinImportLimit(undefined, 5000));
});

test("import: the limit comes from the entitlement, so it can be moved without code changes", () => {
  assert.throws(() => assertWithinImportLimit({ importMaxPerCommit: 10 }, 11), (error) => error.limit === 10 && error.total === 11);
  assert.doesNotThrow(() => assertWithinImportLimit({ importMaxPerCommit: 500 }, 230));
});

test("import: the client sees code, feature, limit and total (\"50 of 230 allowed\") and nothing else extra", () => {
  assert.deepEqual(publicErrorFields(importLimitError(50, 230)), { code: "PLAN_LIMIT", feature: "import", limit: 50, total: 230 });
});

test("publicErrorFields only passes whole, non-negative counts", () => {
  assert.deepEqual(publicErrorFields(new ApiError(403, "x", [], "", { code: "PLAN_LIMIT", limit: "50", total: 1.5 })), { code: "PLAN_LIMIT" });
  assert.deepEqual(publicErrorFields(new ApiError(403, "x", [], "", { limit: -1, total: -1 })), {});
  assert.deepEqual(publicErrorFields(new ApiError(400, "plain")), {});
});
