import { addDays, computeAnalytics, computeLeakEvidence, computeWeekEvidence, dateKey, sampleStrength, tradePnl, tradeR, tradeRisk, weeklyHistory } from "./tradeStats.js";
import { htmlToPlainText } from "./richText.js";
import { inspectMentorData, MODE_SPECIFIC_MENTOR_INSTRUCTIONS } from "./mentorDataQuality.js";

const MAX_WEEK_TRADES = 40; // trades sent in full detail
const MAX_HISTORY_TRADES = 40; // earlier trades sent as one short line each
const NOTE_CHARS = 700;
const PLAN_CHARS = 1200; // written text of one plan
const PLAN_STATUSES = ["executed_as_planned", "executed_with_differences", "plan_not_taken", "unplanned_trade"];
const COMMITMENT_STATUSES = ["kept", "partly_kept", "not_kept", "cannot_tell", "none"];
const CONFIDENCE = ["early", "building", "solid"];
const LOOP_STAGES = ["plan", "execute", "record", "review"];

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
    // only present when a planner is connected to the journal
    planAlignment: {
      type: "OBJECT",
      properties: {
        summary: str,
        days: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { date: str, status: { type: "STRING", enum: PLAN_STATUSES }, detail: str, trades: strList },
            required: ["date", "status", "detail", "trades"],
          },
        },
      },
      required: ["summary", "days"],
    },
    // the anti-edge / flywheel part: what costs the edge, and the one thing to carry into the next plan
    flywheel: {
      type: "OBJECT",
      properties: {
        lastCommitment: {
          type: "OBJECT",
          properties: { status: { type: "STRING", enum: COMMITMENT_STATUSES }, evidence: str },
          required: ["status", "evidence"],
        },
        leaks: {
          type: "ARRAY",
          items: { type: "OBJECT", properties: { title: str, detail: str, cost: str, trades: strList }, required: ["title", "detail", "cost", "trades"] },
        },
        edgeSignal: {
          type: "OBJECT",
          properties: { confidence: { type: "STRING", enum: CONFIDENCE }, detail: str },
          required: ["confidence", "detail"],
        },
        weakestLink: {
          type: "OBJECT",
          properties: { stage: { type: "STRING", enum: LOOP_STAGES }, detail: str },
          required: ["stage", "detail"],
        },
        carryForward: {
          type: "OBJECT",
          properties: { rule: str, planLine: str, checkpoint: str },
          required: ["rule", "planLine", "checkpoint"],
        },
      },
      required: ["lastCommitment", "leaks", "edgeSignal", "weakestLink", "carryForward"],
    },
    nextWeek: strList,
    mentorNote: str,
  },
  required: ["headline", "summary", "discipline", "ruleChecks", "strengths", "issues", "strategyFeedback", "flywheel", "nextWeek", "mentorNote"],
};

/* ------------------------------- prompt ------------------------------- */

export const SYSTEM_PROMPT = `You are an experienced, candid trading mentor reviewing one trader's journal for one week. You are reviewing PROCESS and DISCIPLINE first and results second.

Your job:
0. Follow the journal-mode-specific instructions and data-quality notes in the user prompt. Never treat unknown/missing properties as negative evidence; qualify unsupported claims.
1. Read the trader's written strategy and break it into concrete, checkable rules (entry conditions, risk per trade, stop-loss use, position sizing, trading hours, instruments, max trades, news days, anything else they wrote).
2. Compare each rule with what the trader ACTUALLY did in this week's trade logs (prices, stops, sizes, notes, custom properties) and decide: followed, broken, or unclear (the logs don't contain enough to tell). Cite the trades involved using their T-numbers (e.g. "T3").
3. Separate outcome from process. A loss that followed every rule is a good trade. A win that broke the rules is a warning, not a success. Say so plainly.
4. Judge the strategy itself, not only the trader. Look across the weekly history and the journal-wide numbers. If the same rule keeps being broken, ask whether the rule is unrealistic. If the rules were followed over a meaningful sample and results are still weak, say the strategy may need adjusting and say exactly what to test. If evidence is thin, say "keep" and explain that more trades are needed. Never recommend changes based on one or two trades.
5. Market adaptation: you have NO live market data. Only comment on market conditions when the trader's own logs show a pattern (for example: longs lose while shorts win, one instrument or weekday keeps losing, stops get hit more often than before, win rate shifted versus earlier weeks). Describe it as "your results suggest" and never claim to know what the market did.

6. Plan vs execution (ONLY when the prompt contains a "TRADER'S TRADE PLANS" block, meaning the trader connected a planner to this journal). The plans are what the trader intended to do on each day; the trade logs are what they actually did. Compare them by content (instrument, direction, entry zone, stop, target, size), not just by date: a plan for one day may be executed the next day. Apply these rules strictly:
- A plan is a CONDITIONAL idea ("if price breaks X, buy"), not an obligation. A plan with no matching trade almost always means the entry never triggered, or the trader chose to skip it. You cannot tell which, so say "not triggered or skipped". This is NOT an inconsistency, NOT a missed trade, and NOT a discipline failure. Skipping a setup that did not look right is often good discipline. Only treat it as a problem if the trader's own notes say the setup triggered and they hesitated, or the written strategy explicitly says every valid setup must be taken.
- A trade with no plan for that day is an "unplanned trade". State it neutrally as a fact. It is a rule break only if the written strategy says every trade must be planned in advance. Never call it a mismatch between plan and journal.
- A day with no plan and no trade is a normal day off. Do not mention it.
- A planner connected but holding no plans this week is not a flaw. Plans simply may not have been written. Do not penalise it, and do not claim the trader did not plan unless the strategy requires planning.
- When a trade matches a plan, say it was executed as planned. When it differs, name ONLY the differences that the plan actually specified (for example a different stop, direction or entry zone). Never penalise details the plan did not mention.
- Plans may contain screenshots you cannot see, and a plan with no written text cannot be compared in detail; say so rather than guessing.
- Executed-trade statistics come from the trade logs only. Plans that were not taken do not change win rate, P&L or any other number.
- Never invent plans, triggers or reasons. If the trader's notes do not explain why a plan was skipped, say the reason is not recorded.
Do not mention planning, planners or plans at all when no TRADER'S TRADE PLANS block is present.

Rules of evidence:
- Use only the data given. Never invent trades, prices, rules, or market events. If something can't be verified from the logs (for example the strategy mentions a time window but trades have no time), mark that rule "unclear" and say what the trader should start logging.
- Numbers you quote must come from the data. Use the journal's currency code for money.
- The "Facts computed from the logs" block is ground truth; build on it instead of recalculating.
- The weekly trade count may be small. Acknowledge small samples honestly instead of drawing strong conclusions.

ANTI-EDGE AND THE FLYWHEEL (this is the heart of the review; build the whole answer around it):
A trader improves when a loop keeps turning: PLAN the trade, EXECUTE it, RECORD it honestly, REVIEW it, then REFINE the rules that feed the next plan. Most traders stall because the review never changes the next plan. Your job is to close that loop with ONE specific change, not to hand out praise or a long to-do list.
- "Anti-edge" means a repeatable pattern in THIS trader's own logs that pulls results below what their own written rules produce: a kind of trade, a behaviour, a setup condition or a logging habit that costs expectancy. Find it by comparing groups the "Facts computed from the logs" block already splits for you (first entries versus re-entries after a same-day loss, trades after a same-day loss versus others, checkbox ticked versus not ticked, planned days versus unplanned days) and by reading the notes. Rank by cost: the pattern with the largest measured effect on P&L or R comes first. Put the amount in "cost" (for example "3 trades, -INR 2,909"). If the cost cannot be measured from the data, say so in that field.
- flywheel.lastCommitment: when the prompt has a "LAST REVIEW'S COMMITMENT" block, judge from the trades whether the trader did it: "kept", "partly_kept", "not_kept", or "cannot_tell" when the logs do not show it. Say what in the trades shows that. Without that block use status "none" and an empty evidence string. This is the link that makes the loop turn, so be exact and fair.
- flywheel.leaks: 0 to 3 anti-edge patterns, biggest cost first, each with the trades involved. A strong week may have none: then return an empty list instead of inventing weaknesses.
- flywheel.edgeSignal: what the numbers do and do not support. confidence is "early" when the sample is under 30 closed trades, "building" for 30 to 99, "solid" only from 100 and only when the result holds across weeks. Use the win-rate range from the facts block. Never write that the edge is "clear", "proven", "confirmed" or "robust" below 100 closed trades; say "early read" and what a bigger sample must show.
- flywheel.weakestLink: which stage of the loop is weakest right now and why: "plan" (no plan, plan not specific enough to check), "execute" (rules not followed), "record" (stops, notes or properties missing or contradicting each other, so the review cannot see the truth) or "review" (last period's commitment was ignored or never set). Choose from evidence, one stage only.
- flywheel.carryForward: exactly ONE change. rule: one sentence to add to or tighten in the written strategy, phrased so a trade can be checked against it. planLine: one line the trader writes in their next plan BEFORE trading to apply it. checkpoint: how the next review will judge it, with a number the trader can count (for example "no re-entry on an instrument after its stop-out, over the next 10 trades"). The first item of nextWeek must be this same change.
- Before you propose any limit or threshold, test it against the trades you cite: it must actually block or change the trade you are pointing at. Count the entries in the sequence first (the original entry, then each re-entry) and set the limit so the later trade is caught.

STAY INSIDE THE EVIDENCE (a review that overreaches costs the trader trust, so these are hard rules):
- Terms: "expectancy in R" is the average R per trade. "Reward-to-risk" or "RRR" is the average winner divided by the average loser. They are different numbers: never call expectancy an RRR, and use the labels used in the numbers blocks.
- A loss that closes at exactly -1R shows that the stop was logged and used consistently. In a trade log, with exit prices typed in by the trader, it does not prove discipline under pressure, slippage or gaps. Do not call stop-loss execution "impeccable" or "perfect".
- Do not name an emotion (revenge, FOMO, fear, greed, tilt) unless the trader's own notes use that word or describe it. When they do, write "your note on T14 says FOMO". Otherwise describe the behaviour only (for example "entered a third time on the same instrument after two stop-outs").
- If the facts say the trades look backfilled (many trades on one date), the dates are probably the logging date and not the trade dates. Then do not comment on market phases, days of the week, trends across time or live psychology. Judge rule-following and the numbers only, and say that real trade dates would let the review see more.
- When the dates look backfilled or batch-logged, the T-numbers only show the order the trades were LOGGED, not the order they were taken. Then never call trades "consecutive", "repeated", "re-entries" or "after a loss", and never describe a sequence. Group by instrument or by property instead ("3 trades on TECHM"), and say the shared date once in the whole review (in the summary or the logging-gap issue), not in every section.
- Do not repeat the same point in several sections. Each leak, issue, rule check and action says something the others do not. Quote an average R or a win rate only from the facts block; never work out a new average yourself.
- A group of one to three trades is an observation, not a pattern. Say "in these 3 trades", never "this instrument is choppy" or "clear continuation names".
- Every count you write must be reconcilable. Use counts from the facts block or count the trades you list. If you say "4 trades", name exactly those 4 in "trades". Never list a few examples after "all" or "N of M" claims. If you cannot name them all, give no number.
- Plans that were not taken, and days off, are neutral. Never invent a reason for anything the notes do not explain.

Tone: direct, warm, specific, like a mentor who respects the trader. No hype, no generic advice ("manage risk", "stay disciplined") unless tied to a specific trade or number. Address the trader as "you". Plain text only: no markdown, no bullet characters, no emojis. Do not give buy or sell calls on any instrument and do not predict prices.

Output rules:
- headline: one sentence verdict of the week (max 140 characters).
- summary: 2 to 4 sentences.
- discipline.verdict: "followed", "mostly_followed", "partly_followed", "not_followed", or "cannot_assess". discipline.score is 0 to 100: the share of checkable rules (followed or broken, not unclear) that were followed. The app recomputes it from your ruleChecks, so make the ruleChecks honest and make the two agree. Use cannot_assess with score 0 when the logs don't allow a fair judgement.
- ruleChecks: 3 to 8 of the most important rules from the strategy. "trades" lists T-numbers, or an empty list for week-wide rules.
- strengths: 1 to 2 items about what the logs genuinely support (not what a backtest guarantees), each with the T-numbers involved when they are specific trades. issues: 0 to 2 items that are NOT already in flywheel.leaks, for example logging gaps where checkbox properties contradict the written notes. Do not repeat a leak here.
- strategyFeedback.verdict: "keep", "tweak", or "rethink". suggestedChanges: 0 to 3 specific, testable edits to the written strategy (empty list when verdict is keep). marketAdaptation: 1 to 3 sentences grounded in the trader's own data, or say plainly that the data is too thin to tell.
- planAlignment: ONLY when the TRADER'S TRADE PLANS block is present, otherwise omit it. summary: 1 to 3 sentences on how closely execution matched the plans, treating plans that were not triggered or skipped and unplanned trades as neutral facts. days: one item per day that has a plan or a trade, using the date as written in the prompt. status is "executed_as_planned", "executed_with_differences", "plan_not_taken" (not triggered or skipped), or "unplanned_trade". detail: 1 or 2 sentences. trades: T-numbers involved, or an empty list.
- flywheel: always present, following the rules above. Text fields are plain sentences. leaks[].cost is short ("-INR 2,909 over 3 trades"). carryForward fields are one sentence each.
- nextWeek: exactly 2 or 3 concrete actions for next week. The first one is flywheel.carryForward.rule turned into an action. The others come from leaks or logging gaps and are countable.
- mentorNote: 2 to 3 sentences, personal and honest. Name the one thing that will make the next review better than this one. No praise that the numbers do not back.`;

export const money = (value, currency) => (value === null || value === undefined || Number.isNaN(value) ? "n/a" : `${value < 0 ? "-" : "+"}${currency} ${Math.abs(value).toFixed(2)}`);
export const plain = (value, currency) => (value === null || value === undefined || Number.isNaN(value) ? "n/a" : `${currency} ${value.toFixed(2)}`);
export const pct = (value) => (value === null || value === undefined ? "n/a" : `${Math.round(value * 100)}%`);
export const ratio = (value) => (value === null || value === undefined ? "n/a" : value.toFixed(2));
export const rText = (value) => (value === null || value === undefined ? "n/a" : `${value.toFixed(2)}R`);
export const checkboxLine = (box) => {
  const split = (answer, closed, avgR) => (closed ? `${answer} averaged ${rText(avgR)} over ${closed} closed trade(s)` : null);
  const results = [split("yes", box.yesClosed, box.yesAvgR), split("no", box.noClosed, box.noAvgR)].filter(Boolean);
  return `checkbox "${box.label}": confirmed yes on ${box.yes}, confirmed no on ${box.no}, unknown/unrecorded on ${box.unknown ?? 0}${results.length ? ` (${results.join("; ")})` : ""}`;
};

export const htmlToText = (html = "") =>
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

export const tradeDetail = (trade, label, currency) => {
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

export const tradeLine = (trade, currency) => {
  const pnl = tradePnl(trade);
  const r = tradeR(trade);
  const fields = (trade.customFields ?? []).map(fieldText).filter(Boolean).join("; ");
  return `${dateKey(trade.date)} | ${trade.assetName} ${trade.direction} | ${pnl === null ? "open" : money(pnl, currency)}${r === null ? "" : ` | ${rText(r)}`}${fields ? ` | ${fields}` : ""}`;
};

export const statsBlock = (stats, currency) =>
  [
    `trades ${stats.totalTrades} (${stats.closedTrades} closed, ${stats.openTrades} open)`,
    `net P&L ${money(stats.netPnl, currency)}`,
    `win rate ${pct(stats.winRate)} (${stats.wins} won, ${stats.losses} lost)`,
    `profit factor ${stats.profitFactor === null ? (stats.wins > 0 && stats.losses === 0 ? "no losing trades yet" : "n/a") : ratio(stats.profitFactor)}`,
    `expectancy ${money(stats.expectancy, currency)} per closed trade`,
    `expectancy in R (average R per trade, NOT a reward-to-risk ratio) ${rText(stats.expectancyR)} (${stats.rrrSample} trades have a stop loss)`,
    `reward-to-risk (RRR = average winner / average loser, in R) ${stats.rewardRisk === null ? "n/a" : ratio(stats.rewardRisk)} (average winner ${rText(stats.avgWinR)}, average loser ${rText(stats.avgLossR)})`,
    `average win ${plain(stats.avgWin, currency)}, average loss ${plain(stats.avgLoss, currency)}, payoff ratio by amount ${ratio(stats.payoffRatio)}`,
    `best ${money(stats.bestTrade, currency)}, worst ${money(stats.worstTrade, currency)}`,
    `max drawdown ${plain(stats.maxDrawdown, currency)}, longest win streak ${stats.winStreak}, longest losing streak ${stats.lossStreak}`,
    `long: ${stats.long.count} trades, ${money(stats.long.netPnl, currency)}, ${pct(stats.long.winRate)} win | short: ${stats.short.count} trades, ${money(stats.short.netPnl, currency)}, ${pct(stats.short.winRate)} win`,
  ].join("\n");

const groupLine = (name, group, currency) =>
  `${name}: ${group.count} trade${group.count === 1 ? "" : "s"}, net ${money(group.closed ? group.net : null, currency)}, average ${rText(group.avgR)}, ${group.wins} won of ${group.closed} closed`;

/** The anti-edge facts as prompt lines. `leak` comes from computeLeakEvidence. */
export const leakLines = (leak, currency, { hasPlanner = false } = {}) => {
  const lines = [];
  const range = leak.winRateRange;
  lines.push(
    `sample reliability: ${leak.closedCount} closed trades = "${leak.strength}" (under 30 early, 30 to 99 building, 100+ solid)` +
      (range ? `; the 95% range for the true win rate on this sample is about ${Math.round(range.low * 100)}% to ${Math.round(range.high * 100)}%` : "")
  );
  if (leak.lookedBackfilled) {
    lines.push("trade dates: many trades share one date, so they look backfilled (a backtest or catch-up logging). The dates are probably the logging date, not the trade dates.");
  }

  const re = leak.reEntry;
  if (leak.lookedBackfilled) {
    lines.push("chronology-dependent re-entry and after-loss comparisons suppressed: many trades share one recorded date, so actual execution order is not reliable from these records");
  } else {
    if (re.count) {
      lines.push(`re-entries (a trade on an instrument that had already lost earlier the same day): ${re.count}`);
      lines.push(`  ${groupLine("re-entries", re.group, currency)}`);
      lines.push(`  ${groupLine("all other trades", re.rest, currency)}`);
      re.chains.forEach((chain) =>
        lines.push(`  sequence on ${chain.asset} ${chain.day}: ${chain.count} entries in order (${chain.entries.join(", ")}); ${chain.reEntries} of them were opened right after a losing entry on this instrument; net of the sequence ${money(chain.net, currency)}`)
      );
    } else {
      lines.push("re-entries after a same-day loss on the same instrument: none");
    }
    if (leak.afterLoss.group.count) {
      lines.push(`${groupLine("trades opened after any same-day loss", leak.afterLoss.group, currency)}`);
      lines.push(`${groupLine("trades not opened after a same-day loss", leak.afterLoss.rest, currency)}`);
    }
  }

  leak.checkboxSplits.forEach((box) => {
    if (!box.ticked.count || !box.notTicked.count) return;
    lines.push(`checkbox "${box.label}": ${groupLine("confirmed yes", box.ticked, currency)} | ${groupLine("confirmed no", box.notTicked, currency)}${box.unknown?.count ? ` | ${box.unknown.count} unknown/unrecorded (excluded from comparison)` : ""}`);
  });

  if (leak.riskSpread) {
    lines.push(`risk per trade spread: largest is ${leak.riskSpread.ratio === null ? "n/a" : `${leak.riskSpread.ratio.toFixed(2)}x`} the smallest`);
  }

  if (hasPlanner && leak.planSplit) {
    lines.push(`plans by date only (a plan on a day does not prove a trade matched it): ${leak.planSplit.plannedDays} day(s) with a plan`);
    lines.push(`  ${groupLine("trades on days with a plan", leak.planSplit.onPlannedDays, currency)}`);
    lines.push(`  ${groupLine("trades on days without a plan", leak.planSplit.onUnplannedDays, currency)}`);
  }
  return lines;
};

/** What the previous review asked the trader to carry into this period (from utils/flywheel.js), or null. */
export const commitmentBlock = (last) =>
  last
    ? [
        `=== LAST REVIEW'S COMMITMENT (written for ${last.start} to ${last.end}; judge whether this period's trades show it) ===`,
        `rule to carry forward: ${last.rule}`,
        last.planLine ? `line the trader was to write in each plan: ${last.planLine}` : null,
        last.checkpoint ? `how it was to be checked: ${last.checkpoint}` : null,
        last.source === "next_steps" ? "(that review had no single commitment; this is its first suggested action)" : null,
        "",
      ].filter((line) => line !== null)
    : [];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekday = (key) => WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()];

export const planText = (entry) => {
  const text = htmlToPlainText(entry.content).replace(/\s*\n\s*/g, " / ").slice(0, PLAN_CHARS);
  if (text) return text;
  return (entry.images?.length ?? 0) > 0 ? "(no written text, only screenshots that you cannot see)" : "(no written text)";
};

/**
 * What the trader planned (connected planner) next to what they executed, day by day, plus ground-truth counts.
 * Returns null when no planner is connected, so the prompt then says nothing about planning at all.
 */
export const buildPlanSection = ({ planners, planEntries, shown, extraTrades = [], weekStart, weekEnd, currency }) => {
  if (!planners?.length) return null;

  const plannerNames = new Map(planners.map((planner) => [String(planner._id), planner.name]));
  const tradedLabel = (trade, index) =>
    `T${index + 1} ${trade.assetName} ${trade.direction} qty ${trade.quantity} entry ${trade.entryPrice} stop ${trade.stopLoss ?? "not logged"} exit ${trade.exitPrice ?? "still open"}`;

  const lines = [];
  const planDays = new Set();
  const plannedAndTraded = [];
  const plannedNotTraded = [];
  const tradedNotPlanned = [];

  const dayCount = Math.round((new Date(`${weekEnd}T00:00:00Z`) - new Date(`${weekStart}T00:00:00Z`)) / 86_400_000) + 1;
  for (let offset = 0; offset < dayCount; offset += 1) {
    const day = addDays(weekStart, offset);
    const plans = planEntries.filter((entry) => entry.date === day);
    const trades = shown.map((trade, index) => ({ trade, index })).filter(({ trade }) => dateKey(trade.date) === day);
    // trades of a long date range that are listed without a T-number: they still count as executed that day
    const unnumbered = extraTrades.filter((trade) => dateKey(trade.date) === day);
    const executedCount = trades.length + unnumbered.length;
    if (!plans.length && !executedCount) continue;

    lines.push(`${day} (${weekday(day)})`);
    if (plans.length) {
      planDays.add(day);
      plans.forEach((entry) => {
        lines.push(`  PLAN "${entry.title}" [planner: ${plannerNames.get(String(entry.planner)) ?? "unknown"}]: ${planText(entry)}`);
      });
    } else {
      lines.push("  PLAN: nothing written for this day");
    }
    if (executedCount) {
      unnumbered.forEach((trade) => lines.push(`  EXECUTED (short line, no T-number): ${tradeLine(trade, currency)}`));
      trades.forEach(({ trade, index }) => lines.push(`  EXECUTED: ${tradedLabel(trade, index)}`));
    } else {
      lines.push("  EXECUTED: no trades logged this day");
    }

    if (plans.length && executedCount) plannedAndTraded.push(day);
    else if (plans.length) plannedNotTraded.push(day);
    else tradedNotPlanned.push(day);
  }

  const dayList = (days) => (days.length ? days.join(", ") : "none");
  const out = [
    `Connected planner(s): ${planners.map((planner) => `"${planner.name}" (${planner.type})`).join(", ")}`,
    `plans written for days of this week: ${planEntries.length} plan(s) on ${planDays.size} day(s)`,
    `days with a plan AND trades logged: ${dayList(plannedAndTraded)}`,
    `days with a plan but NO trade logged (entry not triggered, or skipped by choice; the reason is unknown unless the notes say): ${dayList(plannedNotTraded)}`,
    `days with trades but NO plan written (unplanned trades): ${dayList(tradedNotPlanned)}`,
    "",
    "Day by day (days with neither a plan nor a trade are left out; match plans to trades by content, not only by date):",
    ...(lines.length ? lines : ["(nothing planned and nothing traded this week)"]),
  ];
  return out.join("\n");
};

/**
 * Assembles everything the mentor reads. Returns { prompt, tradeLabels } where tradeLabels maps "T3" to a
 * readable name so the answer's trade references can be shown to the user.
 */
export const buildMentorPrompt = ({ journal, weekStart, weekEnd, weekTrades, priorTrades, allTradesToDate, planners = [], planEntries = [], lastCommitment = null }) => {
  const currency = journal.currency ?? "USD";
  const context = journal.context ?? {};
  const quality = inspectMentorData({ journal, trades: weekTrades });

  const shown = weekTrades.slice(0, MAX_WEEK_TRADES);
  const tradeLabels = {};
  const labelByTrade = new Map();
  shown.forEach((trade, index) => {
    // the T-number is part of the readable name, so two trades on the same instrument and day stay distinguishable
    tradeLabels[`T${index + 1}`] = `T${index + 1} · ${dateKey(trade.date)} ${trade.assetName} ${trade.direction}`;
    labelByTrade.set(String(trade._id), `T${index + 1}`);
  });

  const weekStats = computeAnalytics(weekTrades);
  const leak = computeLeakEvidence(weekTrades, { planEntries: planners.length ? planEntries : null, labelOf: (trade) => labelByTrade.get(String(trade._id)) ?? null });
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
    `trades opened after a losing trade the same day: ${leak.lookedBackfilled ? "not assessed (shared dates may be batch logging)" : evidence.tradesTakenAfterSameDayLoss}`,
    `closed losses larger than 1.5R (stop not respected or heavy slippage): ${evidence.lossesBeyondOneAndAHalfR}`,
    `trades with written notes: ${evidence.tradesWithNotes} of ${evidence.tradeCount}`,
    ...evidence.checkboxProperties.map(checkboxLine),
    `by direction: ${evidence.byDirection.map((g) => `${g.name} ${g.trades} trades ${money(g.net, currency)} (${g.wins} won)`).join("; ") || "none closed"}`,
    `by instrument: ${evidence.byAsset.map((g) => `${g.name} ${g.trades} trades ${money(g.net, currency)} (${g.wins} won)`).join("; ") || "none closed"}`,
    `closed trades in the whole journal up to the end of this week: ${overall.closedTrades}`,
    ...leakLines(leak, currency, { hasPlanner: planners.length > 0 }),
  ];

  const historyLines = history.length
    ? history.map((row) => `week of ${row.weekStart}: ${row.trades} trades, net ${money(row.net, currency)}, win rate ${pct(row.winRate)}, expectancy ${rText(row.expectancyR)}`)
    : ["(no earlier weeks with trades)"];

  const priorLines = priorTrades.slice(-MAX_HISTORY_TRADES).map((trade) => tradeLine(trade, currency));

  const planSection = buildPlanSection({ planners, planEntries, shown, weekStart, weekEnd, currency });

  const prompt = [
    `JOURNAL: "${journal.journalName}" | currency ${currency} | mode ${quality.mode}`,
    MODE_SPECIFIC_MENTOR_INSTRUCTIONS[quality.mode],
    "=== DATA QUALITY / LIMITATIONS (computed checks; do not ignore) ===",
    ...quality.lines,
    journal.description ? `Journal description: ${journal.description}` : null,
    `WEEK UNDER REVIEW: ${weekStart} (Monday) to ${weekEnd} (Sunday)`,
    "",
    "=== TRADER'S WRITTEN STRATEGY (the rules they committed to) ===",
    htmlToPlainText(context.strategy),
    defaults.length ? `\nProperties the trader tracks on every trade: ${defaults.join(", ")}` : null,
    "",
    "=== THIS WEEK'S TRADES, as logged ===",
    ...shown.map((trade, index) => tradeDetail(trade, `T${index + 1}`, currency)),
    weekTrades.length > shown.length ? `(${weekTrades.length - shown.length} more trades this week not shown)` : null,
    "",
    planSection ? "=== TRADER'S TRADE PLANS vs WHAT WAS EXECUTED (from the planner connected to this journal) ===" : null,
    planSection,
    planSection ? "" : null,
    ...commitmentBlock(lastCommitment),
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

  return { prompt, tradeLabels, hasPlanContext: Boolean(planSection), hasLast: Boolean(lastCommitment), closedCount: overall.closedTrades };
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

// only kept when a planner was actually connected: otherwise the model has nothing to compare and must not invent it
const sanitizePlanAlignment = (raw, labels, weekStart, weekEnd, maxDays = 14) => {
  const summary = text(raw?.summary, 700);
  const days = list(raw?.days, maxDays, (item) => {
    const date = text(item?.date, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < weekStart || date > weekEnd) return null;
    return {
      date,
      status: oneOf(item.status, PLAN_STATUSES, "plan_not_taken"),
      detail: text(item.detail, 500),
      trades: resolveTrades(item.trades, labels),
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
  return summary || days.length ? { summary, days } : null;
};

// Confidence is capped by the sample, whatever the model says: under 30 closed trades is an early read, full stop.
const sanitizeFlywheel = (raw, labels, { hasLast, closedCount }) => {
  const cap = sampleStrength(closedCount);
  const order = CONFIDENCE;
  const asked = oneOf(raw?.edgeSignal?.confidence, CONFIDENCE, "early");
  const confidence = order.indexOf(asked) > order.indexOf(cap) ? cap : asked;
  const status = hasLast ? oneOf(raw?.lastCommitment?.status, COMMITMENT_STATUSES, "cannot_tell") : "none";

  return {
    lastCommitment: { status, evidence: status === "none" ? "" : text(raw?.lastCommitment?.evidence, 600) },
    leaks: list(raw?.leaks, 3, (item) =>
      text(item?.title, 140) ? { title: text(item.title, 140), detail: text(item.detail, 700), cost: text(item.cost, 160), trades: resolveTrades(item.trades, labels) } : null
    ),
    edgeSignal: { confidence, detail: text(raw?.edgeSignal?.detail, 700) },
    weakestLink: { stage: oneOf(raw?.weakestLink?.stage, LOOP_STAGES, "review"), detail: text(raw?.weakestLink?.detail, 500) },
    carryForward: { rule: text(raw?.carryForward?.rule, 400), planLine: text(raw?.carryForward?.planLine, 400), checkpoint: text(raw?.carryForward?.checkpoint, 400) },
  };
};

/** Never trust the model's JSON blindly: clamp lengths, enforce the enums, resolve trade references. */
export const sanitizeReview = (raw, tradeLabels, { hasPlanContext = false, weekStart = "", weekEnd = "", maxPlanDays = 14, hasLast = false, closedCount = 0 } = {}) => {
  const discipline = raw?.discipline ?? {};
  const feedback = raw?.strategyFeedback ?? {};

  const ruleChecks = list(raw?.ruleChecks, 8, (item) => {
      const rule = text(item?.rule, 220);
      if (!rule) return null;
      return {
        rule,
        status: oneOf(item.status, ["followed", "broken", "unclear"], "unclear"),
        evidence: text(item.evidence, 500),
        trades: resolveTrades(item.trades, tradeLabels),
      };
    });

  // The score is arithmetic, not a feeling: followed rules / (followed + broken). "Can't tell" rules are left out of it.
  const followedCount = ruleChecks.filter((check) => check.status === "followed").length;
  const brokenCount = ruleChecks.filter((check) => check.status === "broken").length;
  const checkable = followedCount + brokenCount;
  const computedScore = checkable ? Math.round((followedCount / checkable) * 100) : null;
  const verdict = computedScore === null ? "cannot_assess" : computedScore >= 95 ? "followed" : computedScore >= 75 ? "mostly_followed" : computedScore >= 40 ? "partly_followed" : "not_followed";
  const score = computedScore;

  return {
    headline: text(raw?.headline, 200),
    summary: text(raw?.summary, 900),
    discipline: { verdict, score, explanation: text(discipline.explanation, 700) },
    ruleChecks,
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
    flywheel: sanitizeFlywheel(raw?.flywheel, tradeLabels, { hasLast, closedCount }),
    planAlignment: hasPlanContext ? sanitizePlanAlignment(raw?.planAlignment, tradeLabels, weekStart, weekEnd, maxPlanDays) : null,
    nextWeek: list(raw?.nextWeek, 3, (item) => text(item, 300) || null),
    mentorNote: text(raw?.mentorNote, 700),
  };
};
