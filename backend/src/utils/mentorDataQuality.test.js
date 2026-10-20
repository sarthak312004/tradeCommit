import test from "node:test";
import assert from "node:assert/strict";
import { inspectMentorData, MODE_SPECIFIC_MENTOR_INSTRUCTIONS } from "./mentorDataQuality.js";

const journal = (mode = "backtest") => ({
  mode,
  context: { attributes: [{ key: "volume", label: "Volume confirmed", type: "checkbox" }] },
});
const trade = (date, overrides = {}) => ({
  date: new Date(`${date}T00:00:00.000Z`),
  assetName: "ABC",
  customFields: [],
  analysis: "",
  ...overrides,
});

test("backtest mode warns when many trades share one recorded date", () => {
  const trades = Array.from({ length: 10 }, () => trade("2026-10-20"));
  const result = inspectMentorData({ journal: journal(), trades });
  assert.equal(result.mode, "backtest");
  assert.ok(result.warnings.some((warning) => warning.includes("batch-import dates")));
  assert.match(MODE_SPECIFIC_MENTOR_INSTRUCTIONS.backtest, /not historical execution chronology/);
});

test("missing checkbox properties are reported as unknown, not negative", () => {
  const result = inspectMentorData({ journal: journal("live"), trades: [trade("2026-10-20")] });
  assert.ok(result.warnings.some((warning) => warning.includes("unknown/ missing")) || result.warnings.some((warning) => warning.includes("missing/unknown")));
  assert.match(MODE_SPECIFIC_MENTOR_INSTRUCTIONS.live, /actual execution/);
});

test("obvious note/property contradictions are flagged for review without changing data", () => {
  const record = trade("2026-10-20", {
    customFields: [{ key: "volume", label: "Volume confirmed", type: "checkbox", value: false }],
    analysis: "Volume was above average and volume confirmation supported the breakout.",
  });
  const result = inspectMentorData({ journal: journal(), trades: [record] });
  assert.ok(result.warnings.some((warning) => warning.includes("conflict")));
  assert.equal(record.customFields[0].value, false);
});

test("checkbox summaries carry the average R of each answer, computed in code", async () => {
  const { computeWeekEvidence } = await import("./tradeStats.js");
  const box = (value) => [{ key: "volume", label: "Volume confirmed", type: "checkbox", value }];
  const make = (exitPrice, value) => trade("2026-10-20", { entryPrice: 100, stopLoss: 99, exitPrice, quantity: 10, direction: "long", customFields: box(value) });
  const evidence = computeWeekEvidence([make(102, true), make(101, true), make(99, false), make(99, false)]);
  const volume = evidence.checkboxProperties.find((item) => item.label === "Volume confirmed");
  assert.equal(volume.yesClosed, 2);
  assert.equal(volume.noClosed, 2);
  assert.equal(volume.yesAvgR, 1.5);
  assert.equal(volume.noAvgR, -1);
});

test("backtest batch-date warning tells the model T-numbers are logging order only", () => {
  const trades = Array.from({ length: 10 }, () => trade("2026-10-20"));
  const result = inspectMentorData({ journal: journal(), trades });
  assert.ok(result.warnings.some((warning) => warning.includes("order the trades were logged")));
});
