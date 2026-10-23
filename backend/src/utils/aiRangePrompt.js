import { computeAnalytics, computeLeakEvidence, computeWeekEvidence, dateKey, mondayOf, weeklyHistory } from "./tradeStats.js";
import { buildPlanSection, checkboxLine, commitmentBlock, leakLines, money, pct, plain, rText, statsBlock, SYSTEM_PROMPT, tradeDetail, tradeLine } from "./aiMentorPrompt.js";
import { htmlToPlainText } from "./richText.js";
import { inspectMentorData, MODE_SPECIFIC_MENTOR_INSTRUCTIONS } from "./mentorDataQuality.js";

// Same JSON schema and sanitiser as the weekly review (the UI renders both with the same component). Only the
// instructions and the prompt change: the trader picks any stretch of dates, so a swing trader's whole campaign
// (entries, adds, exits that span weeks) is judged together instead of being cut at Sunday midnight.
export const MAX_RANGE_DETAILED = 60; // most recent trades of the period sent in full detail
export const MAX_RANGE_CONDENSED = 100; // earlier trades of the period sent as one short line each
const MAX_HISTORY_TRADES = 40;

export const RANGE_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

IMPORTANT: THIS REVIEW COVERS A DATE RANGE CHOSEN BY THE TRADER, NOT ONE WEEK. Wherever the instructions above say "week", read "review period" (it can be a few days or several months). Specifically:
- The trades are listed by date. Some trades may belong to a longer swing campaign: judge each one by the rules that applied when it was entered, and do not call a trade held over several days "late" or "overstaying" unless the strategy or the notes say so. Trades still open at the end of the period are not losses; say they are open.
- Use the "WEEK-BY-WEEK INSIDE THIS PERIOD" table (it is MONTH-BY-MONTH when the period is long) to find trends: is discipline, win rate or risk per trade improving or getting worse as the period goes on? Say which weeks or months stand out and why, citing T-numbers.
- With more trades you may draw firmer conclusions than for a single week, but only from what the data shows. Still avoid recommending strategy changes from one or two trades.
- Earlier trades of the period that have no T-number are given as short lines for context. Never cite them by T-number.
- headline: one sentence verdict of the period. nextWeek: 2 or 3 concrete actions for the NEXT period of trading (the field keeps its name; it is not limited to seven days), the first being the flywheel carry-forward change.
- A longer period is where anti-edge patterns show: look for the same leak recurring in several rows of that table, and say when it appears only once.
- planAlignment.days (only when plans are present): list at most 40 days, choosing the ones that matter most (unplanned trades, differences from the plan, notable executions); skip routine days.`;

// Up to this many weeks with trades are listed one by one; a longer period (up to five years) is summarised per month
// so the prompt stays a sensible size.
const MAX_WEEK_ROWS = 26;

const weekBreakdown = (rangeTrades, currency) => {
  const weeks = new Map();
  for (const trade of rangeTrades) {
    const key = mondayOf(dateKey(trade.date));
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key).push(trade);
  }
  const byMonth = weeks.size > MAX_WEEK_ROWS;
  let groups = weeks;
  if (byMonth) {
    groups = new Map();
    for (const trade of rangeTrades) {
      const key = dateKey(trade.date).slice(0, 7);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(trade);
    }
  }
  const lines = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, trades]) => {
      const stats = computeAnalytics(trades);
      const evidence = computeWeekEvidence(trades);
      return `${byMonth ? "month" : "week of"} ${weekStart}: ${stats.totalTrades} trades (${stats.openTrades} open), net ${money(stats.netPnl, currency)}, win rate ${pct(stats.winRate)}, expectancy ${rText(stats.expectancyR)}, stop logged on ${evidence.stopLossLogged} of ${evidence.tradeCount}, trades after a same-day loss ${evidence.tradesTakenAfterSameDayLoss}`;
    });
  return { byMonth, lines };
};

/**
 * Everything the mentor reads for a date range. Returns { prompt, tradeLabels, hasPlanContext } like buildMentorPrompt.
 * `tradeLabels` maps "T3" to a readable name for the most recent MAX_RANGE_DETAILED trades of the range.
 */
export const buildRangePrompt = ({ journal, rangeStart, rangeEnd, rangeTrades, priorTrades, allTradesToDate, planners = [], planEntries = [], plansTruncated = false, lastCommitment = null }) => {
  const currency = journal.currency ?? "USD";
  const context = journal.context ?? {};
  const quality = inspectMentorData({ journal, trades: rangeTrades });

  const detailed = rangeTrades.slice(-MAX_RANGE_DETAILED);
  const condensed = rangeTrades.slice(0, rangeTrades.length - detailed.length).slice(-MAX_RANGE_CONDENSED);
  const skipped = rangeTrades.length - detailed.length - condensed.length;

  const tradeLabels = {};
  const labelByTrade = new Map();
  detailed.forEach((trade, index) => {
    // the T-number is part of the readable name, so two trades on the same instrument and day stay distinguishable
    tradeLabels[`T${index + 1}`] = `T${index + 1} · ${dateKey(trade.date)} ${trade.assetName} ${trade.direction}`;
    labelByTrade.set(String(trade._id), `T${index + 1}`);
  });

  const periodStats = computeAnalytics(rangeTrades);
  const breakdown = weekBreakdown(rangeTrades, currency);
  const overall = computeAnalytics(allTradesToDate);
  const evidence = computeWeekEvidence(rangeTrades);
  const leak = computeLeakEvidence(rangeTrades, { planEntries: planners.length ? planEntries : null, labelOf: (trade) => labelByTrade.get(String(trade._id)) ?? null });
  const history = weeklyHistory(allTradesToDate, mondayOf(rangeStart));
  const defaults = (context.attributes ?? []).map((attribute) => `${attribute.label} (${attribute.type})`);

  const evidenceLines = [
    `trades in this period: ${evidence.tradeCount} (${evidence.closedCount} closed, ${evidence.openCount} still open) across ${evidence.daysTraded} trading day(s); most trades in one day: ${evidence.maxTradesInOneDay}`,
    `stop loss logged on ${evidence.stopLossLogged} of ${evidence.tradeCount} trades`,
    evidence.riskPerTrade
      ? `risk per trade at the logged stop: average ${plain(evidence.riskPerTrade.avg, currency)}, smallest ${plain(evidence.riskPerTrade.min, currency)}, largest ${plain(evidence.riskPerTrade.max, currency)}`
      : "risk per trade: cannot be computed (no stop losses logged)",
    `trades opened after a losing trade the same day: ${leak.lookedBackfilled ? "not assessed (shared dates may be batch logging)" : evidence.tradesTakenAfterSameDayLoss}`,
    `closed losses larger than 1.5R (stop not respected or heavy slippage): ${evidence.lossesBeyondOneAndAHalfR}`,
    `trades with written notes: ${evidence.tradesWithNotes} of ${evidence.tradeCount}`,
    ...evidence.checkboxProperties.map(checkboxLine),
    `by direction: ${evidence.byDirection.map((g) => `${g.name} ${g.trades} trades ${money(g.net, currency)} (${g.wins} won)`).join("; ") || "none closed"}`,
    `by instrument: ${evidence.byAsset.map((g) => `${g.name} ${g.trades} trades ${money(g.net, currency)} (${g.wins} won)`).join("; ") || "none closed"}`,
    `closed trades in the whole journal up to the end of this period: ${overall.closedTrades}`,
    ...leakLines(leak, currency, { hasPlanner: planners.length > 0 }),
  ];

  const historyLines = history.length
    ? history.map((row) => `week of ${row.weekStart}: ${row.trades} trades, net ${money(row.net, currency)}, win rate ${pct(row.winRate)}, expectancy ${rText(row.expectancyR)}`)
    : ["(no earlier weeks with trades)"];
  const priorLines = priorTrades.slice(-MAX_HISTORY_TRADES).map((trade) => tradeLine(trade, currency));

  // when the earliest trades of a very long range are left out entirely, plans before the first listed trade are left
  // out too, so a day is never reported as "no trade logged" just because its trades were not listed
  const firstListed = skipped > 0 ? dateKey((condensed[0] ?? detailed[0]).date) : rangeStart;
  const comparablePlans = planEntries.filter((entry) => entry.date >= firstListed);
  const planSection = buildPlanSection({ planners, planEntries: comparablePlans, shown: detailed, extraTrades: condensed, weekStart: rangeStart, weekEnd: rangeEnd, currency });

  const prompt = [
    `JOURNAL: "${journal.journalName}" | currency ${currency} | mode ${quality.mode}`,
    MODE_SPECIFIC_MENTOR_INSTRUCTIONS[quality.mode],
    "=== DATA QUALITY / LIMITATIONS (computed checks; do not ignore) ===",
    ...quality.lines,
    journal.description ? `Journal description: ${journal.description}` : null,
    `PERIOD UNDER REVIEW: ${rangeStart} to ${rangeEnd} (inclusive), chosen by the trader`,
    "",
    "=== TRADER'S WRITTEN STRATEGY (the rules they committed to) ===",
    htmlToPlainText(context.strategy),
    defaults.length ? `\nProperties the trader tracks on every trade: ${defaults.join(", ")}` : null,
    "",
    condensed.length || skipped
      ? `=== EARLIER TRADES OF THIS PERIOD, short lines, no T-numbers (date | instrument direction | result | R | properties) ===`
      : null,
    ...condensed.map((trade) => tradeLine(trade, currency)),
    skipped > 0 ? `(${skipped} still earlier trades of this period are not listed, but they are counted in every number below)` : null,
    condensed.length || skipped ? "" : null,
    `=== TRADES OF THIS PERIOD IN FULL DETAIL, oldest first${rangeTrades.length > detailed.length ? ` (the most recent ${detailed.length} of ${rangeTrades.length})` : ""} ===`,
    ...detailed.map((trade, index) => tradeDetail(trade, `T${index + 1}`, currency)),
    "",
    planSection ? "=== TRADER'S TRADE PLANS vs WHAT WAS EXECUTED (from the planner connected to this journal) ===" : null,
    planSection ? (plansTruncated ? "(this period holds many plans: only the most recent ones are included)" : null) : null,
    planSection,
    planSection ? "" : null,
    ...commitmentBlock(lastCommitment),
    "=== Facts computed from the logs (ground truth) ===",
    ...evidenceLines,
    "",
    "=== NUMBERS FOR THIS WHOLE PERIOD (same metrics as the Analysis tab) ===",
    statsBlock(periodStats, currency),
    "",
    `=== ${breakdown.byMonth ? "MONTH-BY-MONTH" : "WEEK-BY-WEEK"} INSIDE THIS PERIOD (oldest first) ===`,
    ...breakdown.lines,
    "",
    "=== WHOLE JOURNAL UP TO THE END OF THIS PERIOD (same metrics as the Analysis tab) ===",
    statsBlock(overall, currency),
    "",
    "=== WEEKS BEFORE THIS PERIOD (oldest first) ===",
    ...historyLines,
    "",
    `=== TRADES JUST BEFORE THIS PERIOD (most recent ${priorLines.length}, one line each: date | instrument direction | result | R | properties) ===`,
    ...(priorLines.length ? priorLines : ["(none)"]),
    "",
    "Write the mentor review for this period now.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { prompt, tradeLabels, hasPlanContext: Boolean(planSection), hasLast: Boolean(lastCommitment), closedCount: overall.closedTrades };
};
