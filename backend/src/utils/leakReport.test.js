import test from "node:test";
import assert from "node:assert/strict";
import { computeLeakReport, leakReportLines } from "./leakReport.js";
import { buildMentorPrompt, sanitizeReview, REVIEW_SCHEMA, SYSTEM_PROMPT } from "./aiMentorPrompt.js";

let n = 0;
const trade = (date, asset, entry, exit, { stop, qty = 10, direction = "long", analysis = "note", customFields = [] } = {}) => ({
  _id: `t${++n}`,
  date: new Date(`${date}T00:00:00.000Z`),
  createdAt: new Date(2026, 0, 1, 0, 0, n),
  assetName: asset,
  direction,
  quantity: qty,
  entryPrice: entry,
  exitPrice: exit,
  stopLoss: stop,
  analysis,
  customFields,
});
const labels = (trades) => {
  const map = new Map(trades.map((t, i) => [String(t._id), `T${i + 1}`]));
  return (t) => map.get(String(t._id)) ?? null;
};

test("too few closed trades reports nothing", () => {
  const trades = [trade("2026-10-19", "AAA", 100, 99, { stop: 99 })];
  const report = computeLeakReport(trades, { labelOf: labels(trades) });
  assert.equal(report.tooFewTrades, true);
  assert.deepEqual(report.items, []);
});

test("re-entry after a same-day stop-out is found, measured and ranked first", () => {
  const trades = [
    trade("2026-10-19", "AAA", 100, 99, { stop: 99 }), // -10
    trade("2026-10-19", "AAA", 100, 98, { stop: 99 }), // re-entry, -20
    trade("2026-10-19", "AAA", 100, 97, { stop: 99 }), // re-entry, -30
    trade("2026-10-20", "BBB", 50, 52, { stop: 49 }), // +20
    trade("2026-10-21", "CCC", 20, 21, { stop: 19 }), // +10
  ];
  const report = computeLeakReport(trades, { labelOf: labels(trades), currency: "INR" });
  const item = report.items.find((entry) => entry.id === "re_entry_after_loss");
  assert.ok(item, "re-entry leak expected");
  assert.equal(item.amount, -50);
  assert.equal(item.count, 2);
  assert.deepEqual(item.trades, ["T2", "T3"]);
  assert.match(item.detail, /INR 50\.00/);
  assert.equal(report.items[0].id, "re_entry_after_loss");
});

test("same trades always give the same report", () => {
  const trades = [
    trade("2026-10-19", "AAA", 100, 99, { stop: 99 }),
    trade("2026-10-19", "AAA", 100, 98, { stop: 99 }),
    trade("2026-10-20", "BBB", 50, 52, { stop: 49 }),
  ];
  const a = computeLeakReport(trades, { labelOf: labels(trades) });
  const b = computeLeakReport(trades, { labelOf: labels(trades) });
  assert.deepEqual(a, b);
});

test("order-based checks are skipped when many trades share one date", () => {
  const trades = Array.from({ length: 10 }, (_, i) => trade("2026-10-19", "AAA", 100, i % 2 ? 101 : 98, { stop: 99 }));
  const report = computeLeakReport(trades, { labelOf: labels(trades), lookedBackfilled: true });
  assert.equal(report.orderChecksSkipped, true);
  assert.ok(!report.items.some((item) => ["re_entry_after_loss", "trades_after_loss", "overtrading_days"].includes(item.id)));
});

test("a loss that ran past the stop reports only the extra loss beyond 1R", () => {
  const trades = [
    trade("2026-10-19", "AAA", 100, 90, { stop: 99 }), // risk 10, pnl -100 => -10R, extra -90
    trade("2026-10-20", "BBB", 50, 52, { stop: 49 }),
    trade("2026-10-21", "CCC", 20, 21, { stop: 19 }),
  ];
  const report = computeLeakReport(trades, { labelOf: labels(trades) });
  const item = report.items.find((entry) => entry.id === "loss_beyond_stop");
  assert.ok(item);
  assert.equal(item.amount, -90);
});

test("profitable patterns are never reported as leaks", () => {
  const trades = [
    trade("2026-10-19", "AAA", 100, 99, { stop: 99 }),
    trade("2026-10-19", "AAA", 100, 105, { stop: 99 }), // re-entry that WON
    trade("2026-10-20", "AAA", 100, 106, { stop: 99 }),
  ];
  const report = computeLeakReport(trades, { labelOf: labels(trades) });
  assert.ok(!report.items.some((item) => item.id === "re_entry_after_loss"));
});

test("missing notes are reported as a time leak with no money amount", () => {
  const trades = Array.from({ length: 6 }, (_, i) => trade(`2026-10-${19 + (i % 3)}`, `S${i}`, 10, 11, { stop: 9, analysis: "" }));
  const report = computeLeakReport(trades, { labelOf: labels(trades) });
  const item = report.items.find((entry) => entry.id === "no_notes");
  assert.ok(item);
  assert.equal(item.kind, "time");
  assert.equal(item.amount, null);
});

test("blank checkbox values are not counted as no", () => {
  const box = (value) => [{ key: "vol", label: "Volume ok", type: "checkbox", value }];
  const trades = [
    ...Array.from({ length: 3 }, (_, i) => trade(`2026-10-${19 + i}`, `Y${i}`, 10, 11, { stop: 9, customFields: box(true) })),
    ...Array.from({ length: 3 }, (_, i) => trade(`2026-10-${19 + i}`, `N${i}`, 10, 8, { stop: 9, customFields: box(false) })),
    ...Array.from({ length: 3 }, (_, i) => trade(`2026-10-${22 + i}`, `U${i}`, 10, 5, { stop: 9, customFields: box(null) })),
  ];
  const report = computeLeakReport(trades, { labelOf: labels(trades) });
  const item = report.items.find((entry) => entry.id.startsWith("property_"));
  assert.ok(item);
  assert.equal(item.count, 3); // only the three confirmed "no" trades, not the unknown ones
});

test("prompt carries the leak block, the schema has no score or strategy verdict, and the saved review keeps the report", () => {
  const trades = [
    trade("2026-10-19", "AAA", 100, 99, { stop: 99 }),
    trade("2026-10-19", "AAA", 100, 98, { stop: 99 }),
    trade("2026-10-19", "AAA", 100, 97, { stop: 99 }),
    trade("2026-10-20", "BBB", 50, 52, { stop: 49 }),
  ];
  const journal = { journalName: "J", currency: "INR", mode: "live", context: { strategy: "<p>Risk 1% per trade, always use a stop.</p>", attributes: [] } };
  const built = buildMentorPrompt({ journal, weekStart: "2026-10-19", weekEnd: "2026-10-25", weekTrades: trades, priorTrades: [], allTradesToDate: trades });
  assert.match(built.prompt, /MONEY AND TIME LEAKS FOUND BY THE APP/);
  assert.match(built.prompt, /re_entry_after_loss/);
  assert.ok(!("strategyFeedback" in REVIEW_SCHEMA.properties));
  assert.ok(!("score" in REVIEW_SCHEMA.properties.discipline.properties));
  assert.ok(!/strategyFeedback|share of checkable rules|discipline.score/.test(SYSTEM_PROMPT));

  const raw = { headline: "h", summary: "s", discipline: { explanation: "ok", score: 87, verdict: "followed" }, ruleChecks: [{ rule: "r", status: "followed", evidence: "e", trades: ["T1"] }], strengths: [], issues: [], strategyFeedback: { verdict: "rethink" }, flywheel: {}, nextWeek: [], mentorNote: "" };
  const review = sanitizeReview(raw, built.tradeLabels, { leakReport: built.leakReport, closedCount: 4 });
  assert.equal(review.discipline.score, null);
  assert.equal(review.strategyFeedback.verdict, "keep"); // legacy placeholder only
  assert.equal(review.strategyFeedback.reasoning, "");
  assert.ok(review.leakReport.items.length > 0);
  assert.ok(review.leakReport.items[0].trades[0].startsWith("T"));
  assert.ok(leakReportLines(built.leakReport, "INR").length > 0);
});
