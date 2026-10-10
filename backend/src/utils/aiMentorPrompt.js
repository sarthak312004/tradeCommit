import { computeAnalytics, computeWeekEvidence, dateKey, tradePnl, tradeR, tradeRisk, weeklyHistory } from "./tradeStats.js";

const MAX_WEEK_TRADES = 40; // trades sent in full detail
const MAX_HISTORY_TRADES = 40; // earlier trades sent as one short line each
const NOTE_CHARS = 700;

/* ------------------------------- schema ------------------------------- */

const str = { type: "STRING" };
const strList = { type: "ARRAY", items: str };
const titled = (extra = {}) => ({
  type: "OBJECT",
  properties: { title: str, detail: str, ...extra },
  required: ["title", "detail", ...Object.keys(extra)],
});

export const REVIEW_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: str,
    summary: str,
    discipline: {
      type: "OBJECT",
      properties: {
        verdict: { type: "STRING", enum: ["followed", "mostly_followed", "partly_followed", "not_followed", "cannot_assess"] },
        score: { type: "INTEGER" },
        explanation: str,
      },
      required: ["verdict", "score", "explanation"],
    },
    ruleChecks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { rule: str, status: { type: "STRING", enum: ["followed", "broken", "unclear"] }, evidence: str, trades: strList },
        required: ["rule", "status", "evidence", "trades"],
      },
    },
    strengths: { type: "ARRAY", items: titled() },
    issues: { type: "ARRAY", items: titled({ trades: strList }) },
    strategyFeedback: {
      type: "OBJECT",
      properties: {
        verdict: { type: "STRING", enum: ["keep", "tweak", "rethink"] },
        reasoning: str,
        suggestedChanges: strList,
        marketAdaptation: str,
      },
      required: ["verdict", "reasoning", "suggestedChanges", "marketAdaptation"],
    },
    nextWeek: strList,
    mentorNote: str,
  },
  required: ["headline", "summary", "discipline", "ruleChecks", "strengths", "issues", "strategyFeedback", "nextWeek", "mentorNote"],
};

/* ------------------------------- prompt ------------------------------- */

export const SYSTEM_PROMPT = `You are an experienced, candid trading mentor reviewing one trader's journal for one week. You are reviewing PROCESS and DISCIPLINE first and results second.

Your job:
1. Read the trader's written strategy and break it into concrete, checkable rules (entry conditions, risk per trade, stop-loss use, position sizing, trading hours, instruments, max trades, news days, anything else they wrote).
2. Compare each rule with what the trader ACTUALLY did in this week's trade logs (prices, stops, sizes, notes, custom properties) and decide: followed, broken, or unclear (the logs don't contain enough to tell). Cite the trades involved using their T-numbers (e.g. "T3").
3. Separate outcome from process. A loss that followed every rule is a good trade. A win that broke the rules is a warning, not a success. Say so plainly.
4. Judge the strategy itself, not only the trader. Look across the weekly history and the journal-wide numbers. If the same rule keeps being broken, ask whether the rule is unrealistic. If the rules were followed over a meaningful sample and results are still weak, say the strategy may need adjusting and say exactly what to test. If evidence is thin, say "keep" and explain that more trades are needed. Never recommend changes based on one or two trades.
5. Market adaptation: you have NO live market data. Only comment on market conditions when the trader's own logs show a pattern (for example: longs lose while shorts win, one instrument or weekday keeps losing, stops get hit more often than before, win rate shifted versus earlier weeks). Describe it as "your results suggest" and never claim to know what the market did.

Rules of evidence:
- Use only the data given. Never invent trades, prices, rules, or market events. If something can't be verified from the logs (for example the strategy mentions a time window but trades have no time), mark that rule "unclear" and say what the trader should start logging.
- Numbers you quote must come from the data. Use the journal's currency code for money.
- The "Facts computed from the logs" block is ground truth; build on it instead of recalculating.
- The weekly trade count may be small. Acknowledge small samples honestly instead of drawing strong conclusions.

Tone: direct, warm, specific, like a mentor who respects the trader. No hype, no generic advice ("manage risk", "stay disciplined") unless tied to a specific trade or number. Address the trader as "you". Plain text only: no markdown, no bullet characters, no emojis. Do not give buy or sell calls on any instrument and do not predict prices.

Output rules:
- headline: one sentence verdict of the week (max 140 characters).
- summary: 2 to 4 sentences.
- discipline.verdict: "followed", "mostly_followed", "partly_followed", "not_followed", or "cannot_assess". discipline.score is 0 to 100 (share of checkable rules followed, weighted by importance). Use cannot_assess with score 0 when the logs don't allow a fair judgement.
- ruleChecks: 3 to 8 of the most important rules from the strategy. "trades" lists T-numbers, or an empty list for week-wide rules.
- strengths: 1 to 3 items. issues: 1 to 4 items, most important first, each with the T-numbers involved.
- strategyFeedback.verdict: "keep", "tweak", or "rethink". suggestedChanges: 0 to 3 specific, testable edits to the written strategy (empty list when verdict is keep). marketAdaptation: 1 to 3 sentences grounded in the trader's own data, or say plainly that the data is too thin to tell.
- nextWeek: exactly 2 or 3 concrete actions for next week.
- mentorNote: 2 to 3 sentences, personal and encouraging but honest.`;

const money = (value, currency) => (value === null || value === undefined || Number.isNaN(value) ? "n/a" : `${value < 0 ? "-" : "+"}${currency} ${Math.abs(value).toFixed(2)}`);
const plain = (value, currency) => (value === null || value === undefined || Number.isNaN(value) ? "n/a" : `${currency} ${value.toFixed(2)}`);
const pct = (value) => (value === null || value === undefined ? "n/a" : `${Math.round(value * 100)}%`);
const ratio = (value) => (value === null || value === undefined ? "n/a" : value.toFixed(2));
const rText = (value) => (value === null || value === undefined ? "n/a" : `${value.toFixed(2)}R`);

const htmlToText = (html = "") =>
  String(html)
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, ". ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .replace(/(\. )+/g, ". ")
    .trim();

const fieldText = (field) => {
  if (field.value === null || field.value === undefined || field.value === "") return null;
  if (field.type === "checkbox") return `${field.label}: ${field.value ? "yes" : "no"}`;
  return `${field.label}: ${String(field.value).slice(0, 200)}`;
};

const tradeDetail = (trade, label, currency) => {
  const pnl = tradePnl(trade);
  const r = tradeR(trade);
  const risk = tradeRisk(trade);
  const fields = (trade.customFields ?? []).map(fieldText).filter(Boolean);
  const note = htmlToText(trade.analysis).slice(0, NOTE_CHARS);
  return [
    `${label} | ${dateKey(trade.date)} | ${trade.assetName} | ${trade.direction} | qty ${trade.quantity}`,
    `  entry ${trade.entryPrice} | exit ${trade.exitPrice ?? "still open"} | stop ${trade.stopLoss ?? "not logged"}`,
    `  result: ${pnl === null ? "open" : money(pnl, currency)}${r === null ? "" : ` (${rText(r)})`}${risk === null ? "" : ` | risk at stop ${plain(risk, currency)}`}`,
    fields.length ? `  properties: ${fields.join("; ")}` : null,
    `  trader's notes: ${note || "(none written)"}`,
  ]
    .filter(Boolean)
    .join("\n");
};

const tradeLine = (trade, currency) => {
  const pnl = tradePnl(trade);
  const r = tradeR(trade);
  const fields = (trade.customFields ?? []).map(fieldText).filter(Boolean).join("; ");
  return `${dateKey(trade.date)} | ${trade.assetName} ${trade.direction} | ${pnl === null ? "open" : money(pnl, currency)}${r === null ? "" : ` | ${rText(r)}`}${fields ? ` | ${fields}` : ""}`;
};

const statsBlock = (stats, currency) =>
  [
    `trades ${stats.totalTrades} (${stats.closedTrades} closed, ${stats.openTrades} open)`,
    `net P&L ${money(stats.netPnl, currency)}`,
    `win rate ${pct(stats.winRate)} (${stats.wins} won, ${stats.losses} lost)`,
    `profit factor ${stats.profitFactor === null ? (stats.wins > 0 && stats.losses === 0 ? "no losing trades yet" : "n/a") : ratio(stats.profitFactor)}`,
    `expectancy ${money(stats.expectancy, currency)} per closed trade`,
    `average R ${rText(stats.avgRrr)} (${stats.rrrSample} trades have a stop loss)`,
    `average win ${plain(stats.avgWin, currency)}, average loss ${plain(stats.avgLoss, currency)}, payoff ratio ${ratio(stats.payoffRatio)}`,
    `best ${money(stats.bestTrade, currency)}, worst ${money(stats.worstTrade, currency)}`,
    `max drawdown ${plain(stats.maxDrawdown, currency)}, longest win streak ${stats.winStreak}, longest losing streak ${stats.lossStreak}`,
    `long: ${stats.long.count} trades, ${money(stats.long.netPnl, currency)}, ${pct(stats.long.winRate)} win | short: ${stats.short.count} trades, ${money(stats.short.netPnl, currency)}, ${pct(stats.short.winRate)} win`,
  ].join("\n");

/**
 * Assembles everything the mentor reads. Returns { prompt, tradeLabels } where tradeLabels maps "T3" to a
 * readable name so the answer's trade references can be shown to the user.
 */
export const buildMentorPrompt = ({ journal, weekStart, weekEnd, weekTrades, priorTrades, allTradesToDate }) => {
  const currency = journal.currency ?? "USD";
  const context = journal.context ?? {};

  const shown = weekTrades.slice(0, MAX_WEEK_TRADES);
  const tradeLabels = {};
  shown.forEach((trade, index) => {
    tradeLabels[`T${index + 1}`] = `${dateKey(trade.date)} ${trade.assetName} ${trade.direction}`;
  });

  const weekStats = computeAnalytics(weekTrades);
  const overall = computeAnalytics(allTradesToDate);
  const evidence = computeWeekEvidence(weekTrades);
  const history = weeklyHistory(allTradesToDate, weekStart);

  const defaults = (context.attributes ?? []).map((attribute) => `${attribute.label} (${attribute.type})`);

  const evidenceLines = [
    `trades this week: ${evidence.tradeCount} (${evidence.closedCount} closed, ${evidence.openCount} open) across ${evidence.daysTraded} trading day(s); most trades in one day: ${evidence.maxTradesInOneDay}`,
    `stop loss logged on ${evidence.stopLossLogged} of ${evidence.tradeCount} trades`,
    evidence.riskPerTrade
      ? `risk per trade at the logged stop: average ${plain(evidence.riskPerTrade.avg, currency)}, smallest ${plain(evidence.riskPerTrade.min, currency)}, largest ${plain(evidence.riskPerTrade.max, currency)}`
      : "risk per trade: cannot be computed (no stop losses logged)",
    `trades opened after a losing trade the same day: ${evidence.tradesTakenAfterSameDayLoss}`,
    `closed losses larger than 1.5R (stop not respected or heavy slippage): ${evidence.lossesBeyondOneAndAHalfR}`,
    `trades with written notes: ${evidence.tradesWithNotes} of ${evidence.tradeCount}`,
    ...evidence.checkboxProperties.map((box) => `checkbox "${box.label}": ticked on ${box.yes}, not ticked on ${box.no}`),
    `by direction: ${evidence.byDirection.map((g) => `${g.name} ${g.trades} trades ${money(g.net, currency)} (${g.wins} won)`).join("; ") || "none closed"}`,
    `by instrument: ${evidence.byAsset.map((g) => `${g.name} ${g.trades} trades ${money(g.net, currency)} (${g.wins} won)`).join("; ") || "none closed"}`,
  ];

  const historyLines = history.length
    ? history.map((row) => `week of ${row.weekStart}: ${row.trades} trades, net ${money(row.net, currency)}, win rate ${pct(row.winRate)}, avg R ${rText(row.avgRrr)}`)
    : ["(no earlier weeks with trades)"];

  const priorLines = priorTrades.slice(-MAX_HISTORY_TRADES).map((trade) => tradeLine(trade, currency));

  const prompt = [
    `JOURNAL: "${journal.journalName}" | currency ${currency}`,
    journal.description ? `Journal description: ${journal.description}` : null,
    `WEEK UNDER REVIEW: ${weekStart} (Monday) to ${weekEnd} (Sunday)`,
    "",
    "=== TRADER'S WRITTEN STRATEGY (the rules they committed to) ===",
    context.strategy,
    defaults.length ? `\nProperties the trader tracks on every trade: ${defaults.join(", ")}` : null,
    "",
    "=== THIS WEEK'S TRADES, as logged ===",
    ...shown.map((trade, index) => tradeDetail(trade, `T${index + 1}`, currency)),
    weekTrades.length > shown.length ? `(${weekTrades.length - shown.length} more trades this week not shown)` : null,
    "",
    "=== Facts computed from the logs (ground truth) ===",
    ...evidenceLines,
    "",
    "=== THIS WEEK'S NUMBERS (same metrics as the Analysis tab) ===",
    statsBlock(weekStats, currency),
    "",
    "=== WHOLE JOURNAL UP TO THE END OF THIS WEEK (same metrics as the Analysis tab) ===",
    statsBlock(overall, currency),
    "",
    "=== PREVIOUS WEEKS (oldest first) ===",
    ...historyLines,
    "",
    `=== EARLIER TRADES BEFORE THIS WEEK (most recent ${priorLines.length}, one line each: date | instrument direction | result | R | properties) ===`,
    ...(priorLines.length ? priorLines : ["(none)"]),
    "",
    "Write the weekly mentor review now.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { prompt, tradeLabels };
};

/* ---------------------------- sanitising ---------------------------- */

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const list = (value, max, map) => (Array.isArray(value) ? value.slice(0, max).map(map).filter(Boolean) : []);
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

// turns ["T3", "t5"] into readable names, dropping anything that isn't a real trade of that week
const resolveTrades = (value, labels) =>
  list(value, 8, (ref) => {
    const match = String(ref).toUpperCase().match(/T\d+/);
    return match ? labels[match[0]] ?? null : null;
  });

/** Never trust the model's JSON blindly: clamp lengths, enforce the enums, resolve trade references. */
export const sanitizeReview = (raw, tradeLabels) => {
  const discipline = raw?.discipline ?? {};
  const verdict = oneOf(discipline.verdict, ["followed", "mostly_followed", "partly_followed", "not_followed", "cannot_assess"], "cannot_assess");
  const score = Number.isFinite(Number(discipline.score)) ? Math.min(100, Math.max(0, Math.round(Number(discipline.score)))) : 0;
  const feedback = raw?.strategyFeedback ?? {};

  return {
    headline: text(raw?.headline, 200),
    summary: text(raw?.summary, 900),
    discipline: { verdict, score: verdict === "cannot_assess" ? null : score, explanation: text(discipline.explanation, 700) },
    ruleChecks: list(raw?.ruleChecks, 8, (item) => {
      const rule = text(item?.rule, 220);
      if (!rule) return null;
      return {
        rule,
        status: oneOf(item.status, ["followed", "broken", "unclear"], "unclear"),
        evidence: text(item.evidence, 500),
        trades: resolveTrades(item.trades, tradeLabels),
      };
    }),
    strengths: list(raw?.strengths, 3, (item) => (text(item?.title, 120) ? { title: text(item.title, 120), detail: text(item.detail, 600) } : null)),
    issues: list(raw?.issues, 4, (item) =>
      text(item?.title, 120) ? { title: text(item.title, 120), detail: text(item.detail, 700), trades: resolveTrades(item.trades, tradeLabels) } : null
    ),
    strategyFeedback: {
      verdict: oneOf(feedback.verdict, ["keep", "tweak", "rethink"], "keep"),
      reasoning: text(feedback.reasoning, 900),
      suggestedChanges: list(feedback.suggestedChanges, 3, (item) => text(item, 400) || null),
      marketAdaptation: text(feedback.marketAdaptation, 700),
    },
    nextWeek: list(raw?.nextWeek, 3, (item) => text(item, 300) || null),
    mentorNote: text(raw?.mentorNote, 700),
  };
};
