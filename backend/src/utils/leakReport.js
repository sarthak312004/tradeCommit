import { dateKey, sampleStrength, tradePnl, tradeR, tradeRisk } from "./tradeStats.js";

// "Where you are losing money and time": the part of the review that is computed by CODE, not written by the AI.
//
// Every number here comes straight from the trade logs, so the same trades always give the same answer (no drifting
// percentages, no verdicts on the trader's strategy). Each detector looks for ONE behaviour that is known to cost
// traders money or time, measures what those exact trades did, and only reports it when the result was a loss.
// The AI receives this list as ground truth (see aiMentorPrompt.js) and may explain it, but it cannot change it.
//
// Honesty rules baked in:
//  - The amount is what the trades in the pattern netted. It shows where money went; it does not prove the pattern
//    caused the loss, and amounts of different patterns can overlap, so they must never be added together.
//  - Order-based patterns (re-entries, trades after a loss, overtrading) are skipped when many trades share one date,
//    because then the logged date is probably the logging date and the real order of trades is unknown.
//  - A pattern needs a minimum number of closed trades before it is reported.
//  - Nothing is reported as a leak when it was not a loss.

const MIN_CLOSED_FOR_REPORT = 3;
const MAX_ITEMS = 5;
const MAX_TRADE_REFS = 8;
const STOP_BREACH_R = -1.5; // same threshold as the "closed losses larger than 1.5R" fact the mentor already reads

const sum = (values) => values.reduce((total, value) => total + value, 0);
const avg = (values) => (values.length ? sum(values) / values.length : null);
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const round2 = (value) => Math.round(value * 100) / 100;
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
const assetKey = (trade) => String(trade.assetName ?? "").trim().toLowerCase();
const hasNote = (trade) => String(trade.analysis ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim().length > 0;

/** closed-trade stats of a group of items */
const groupOf = (items) => {
  const closed = items.filter((item) => item.pnl !== null);
  const rs = closed.map((item) => item.r).filter((value) => value !== null);
  return { count: items.length, closed: closed.length, net: sum(closed.map((item) => item.pnl)), avgR: avg(rs), closedItems: closed };
};

// the group did worse per trade than the comparison group (or there is nothing to compare with, so net alone decides)
const notBetterThan = (group, rest) => {
  if (group.avgR === null || rest.avgR === null) return true;
  return group.avgR < rest.avgR;
};

/**
 * @param trades   lean trade documents of the period being reviewed
 * @param options  labelOf(trade) -> "T3" or null; planEntries (array or null) for plan-vs-no-plan; lookedBackfilled;
 *                 currency (journal currency code, used inside the sentences)
 * @returns {{ items, closedCount, confidence, orderChecksSkipped, tooFewTrades }}
 *   items[]: { id, kind: "money" | "time" | "both", title, detail, amount (negative = lost, journal currency, or null
 *   when it cannot be measured), count, trades: ["T3", ...], fix, confidence }
 */
export const computeLeakReport = (trades, { labelOf = () => null, planEntries = null, lookedBackfilled = false, currency = "USD" } = {}) => {
  const money = (value) => `${value < 0 ? "-" : ""}${currency} ${Math.abs(value).toFixed(2)}`;
  const ordered = [...trades].sort((a, b) => {
    const byDay = dateKey(a.date).localeCompare(dateKey(b.date));
    return byDay || new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0);
  });
  const items = ordered.map((trade) => ({ trade, day: dateKey(trade.date), pnl: tradePnl(trade), r: tradeR(trade), risk: tradeRisk(trade), label: labelOf(trade) }));
  const closed = items.filter((item) => item.pnl !== null);
  const confidence = sampleStrength(closed.length);
  const base = { closedCount: closed.length, confidence, orderChecksSkipped: Boolean(lookedBackfilled) && items.length >= 8, tooFewTrades: false };

  if (closed.length < MIN_CLOSED_FOR_REPORT) return { ...base, tooFewTrades: true, items: [] };

  const found = [];
  const refs = (list) => list.map((item) => item.label).filter(Boolean).slice(0, MAX_TRADE_REFS);
  const add = (entry) => found.push({ amount: null, trades: [], confidence, ...entry });
  const orderOk = !base.orderChecksSkipped;

  /* ---------- 1. trading the same instrument again right after it stopped you out (same day) ---------- */
  const reEntrySet = new Set();
  if (orderOk) {
    items.forEach((item, index) => {
      const earlier = items.slice(0, index).filter((other) => other.day === item.day && assetKey(other.trade) === assetKey(item.trade));
      const last = earlier[earlier.length - 1];
      if (last && last.pnl !== null && last.pnl < 0) reEntrySet.add(item);
    });
    const group = groupOf([...reEntrySet]);
    const rest = groupOf(items.filter((item) => !reEntrySet.has(item)));
    if (group.closed >= 2 && group.net < 0 && notBetterThan(group, rest)) {
      add({
        id: "re_entry_after_loss",
        kind: "money",
        title: "Re-entering an instrument right after it stopped you out",
        detail: `${plural(group.count, "trade")} reopened an instrument that had already lost earlier the same day. Together they netted ${money(group.net)}${group.avgR !== null ? `, averaging ${group.avgR.toFixed(2)}R` : ""}${rest.avgR !== null ? ` against ${rest.avgR.toFixed(2)}R for your other trades` : ""}.`,
        amount: round2(group.net),
        count: group.count,
        trades: refs([...reEntrySet]),
        fix: "Add a rule: after a stop-out, no new entry on that instrument until a fresh setup is written in your plan (or the next session).",
      });
    }
  }

  /* ---------- 2. other trades opened after a same-day loss ---------- */
  if (orderOk) {
    const afterLoss = [];
    const lossDays = new Set();
    for (const item of items) {
      if (lossDays.has(item.day) && !reEntrySet.has(item)) afterLoss.push(item);
      if (item.pnl !== null && item.pnl < 0) lossDays.add(item.day);
    }
    const group = groupOf(afterLoss);
    const afterSet = new Set(afterLoss);
    const rest = groupOf(items.filter((item) => !afterSet.has(item) && !reEntrySet.has(item)));
    if (group.closed >= 3 && group.net < 0 && notBetterThan(group, rest)) {
      add({
        id: "trades_after_loss",
        kind: "money",
        title: "Taking more trades after a losing trade the same day",
        detail: `${plural(group.count, "trade")} were opened after a loss earlier that day (re-entries on the same instrument are counted separately). They netted ${money(group.net)}${group.avgR !== null ? `, averaging ${group.avgR.toFixed(2)}R` : ""}${rest.avgR !== null ? ` against ${rest.avgR.toFixed(2)}R for your other trades` : ""}.`,
        amount: round2(group.net),
        count: group.count,
        trades: refs(afterLoss),
        fix: "Set a daily stop: after one loss (or a fixed loss amount), decide in advance whether you trade on, and write the answer in your plan.",
      });
    }
  }

  /* ---------- 3. losses that ran past the planned risk ---------- */
  {
    const breaches = closed.filter((item) => item.r !== null && item.r < STOP_BREACH_R && item.risk !== null);
    if (breaches.length) {
      const extra = sum(breaches.map((item) => item.pnl + item.risk)); // loss beyond the 1R the stop allowed (negative)
      if (extra < 0) {
        add({
          id: "loss_beyond_stop",
          kind: "money",
          title: "Losses bigger than the risk you set",
          detail: `${plural(breaches.length, "trade")} closed worse than ${STOP_BREACH_R}R, so the exit was well past the logged stop. The logs do not show why. Beyond the 1R each stop allowed, they lost an extra ${money(Math.abs(extra))}.`,
          amount: round2(extra),
          count: breaches.length,
          trades: refs(breaches),
          fix: "Place the stop order at entry and never move it away from price. If a gap or slippage did this, note it on the trade so the review can tell the difference.",
        });
      }
    }
  }

  /* ---------- 4. trades with no stop logged ---------- */
  {
    const noStop = closed.filter((item) => item.risk === null);
    const group = groupOf(noStop);
    if (group.closed >= 3 && group.net < 0) {
      add({
        id: "no_stop_logged",
        kind: "money",
        title: "Trades with no stop logged",
        detail: `${plural(group.closed, "closed trade")} have no stop loss on record, so their risk cannot be measured. They netted ${money(group.net)}.`,
        amount: round2(group.net),
        count: group.closed,
        trades: refs(noStop),
        fix: "Fill in the stop before you enter. A trade with no stop cannot be sized, and the review cannot tell a plan from a hope.",
      });
    }
  }

  /* ---------- 5. oversized risk (a few trades risking far more than your usual) ---------- */
  {
    const withRisk = closed.filter((item) => item.risk !== null);
    const typical = median(withRisk.map((item) => item.risk));
    if (withRisk.length >= 4 && typical) {
      const big = withRisk.filter((item) => item.risk > typical * 1.5);
      const group = groupOf(big);
      if (big.length >= 2 && big.length < withRisk.length && group.net < 0) {
        add({
          id: "oversized_risk",
          kind: "money",
          title: "A few trades risked far more than your usual size",
          detail: `${plural(big.length, "trade")} risked more than 1.5 times your typical risk (${money(typical)} at the stop). They netted ${money(group.net)}.`,
          amount: round2(group.net),
          count: big.length,
          trades: refs(big),
          fix: "Fix the amount you risk per trade (a number, not a feeling) and size every position from the stop distance.",
        });
      }
    }
  }

  /* ---------- 6. overtrading days: the trades beyond your normal count for a day ---------- */
  if (orderOk) {
    const perDay = new Map();
    for (const item of items) perDay.set(item.day, [...(perDay.get(item.day) ?? []), item]);
    const counts = [...perDay.values()].map((list) => list.length);
    const usual = median(counts);
    if (perDay.size >= 3 && usual) {
      const limit = Math.max(2, Math.ceil(usual));
      const heavyDays = [...perDay.entries()].filter(([, list]) => list.length >= Math.max(4, usual * 2));
      const extras = heavyDays.flatMap(([, list]) => list.slice(limit));
      const group = groupOf(extras);
      if (heavyDays.length && group.closed >= 2 && group.net < 0) {
        add({
          id: "overtrading_days",
          kind: "both",
          title: "Trades beyond your usual count on busy days",
          detail: `On ${plural(heavyDays.length, "day")} you traded at least twice your usual number (usual: ${limit} a day, busiest: ${Math.max(...heavyDays.map(([, list]) => list.length))}). The ${plural(extras.length, "trade")} past your usual count netted ${money(group.net)}, and each one also cost screen time and review time.`,
          amount: round2(group.net),
          count: extras.length,
          trades: refs(extras),
          fix: "Set a maximum number of trades per day in your plan and stop the session when you reach it.",
        });
      }
    }
  }

  /* ---------- 7. one instrument that keeps losing ---------- */
  {
    const byAsset = new Map();
    for (const item of closed) byAsset.set(assetKey(item.trade), [...(byAsset.get(assetKey(item.trade)) ?? []), item]);
    const losers = [...byAsset.values()]
      .map((list) => ({ list, group: groupOf(list), name: list[0].trade.assetName }))
      .filter(({ group }) => group.closed >= 4 && group.net < 0 && group.closedItems.filter((item) => item.pnl > 0).length / group.closed <= 0.4)
      .sort((a, b) => a.group.net - b.group.net)
      .slice(0, 2);
    for (const { list, group, name } of losers) {
      add({
        id: `instrument_${assetKey(list[0].trade).replace(/[^a-z0-9]+/g, "_").slice(0, 30)}`,
        kind: "money",
        title: `${name}: ${group.closedItems.filter((item) => item.pnl > 0).length} winners in ${group.closed} trades`,
        detail: `${plural(group.closed, "closed trade")} on ${name} netted ${money(group.net)}${group.avgR !== null ? `, averaging ${group.avgR.toFixed(2)}R` : ""}. This is what your logs show for this period; it is an early read until the sample grows.`,
        amount: round2(group.net),
        count: group.closed,
        trades: refs(list),
        confidence: group.closed >= 8 ? confidence : "early",
        fix: `Before the next ${name} trade, write down what your edge on it is. If you cannot, trade it smaller or skip it until you can.`,
      });
    }
  }

  /* ---------- 8. one direction losing while the other makes money ---------- */
  {
    const longs = groupOf(closed.filter((item) => String(item.trade.direction).toLowerCase() !== "short"));
    const shorts = groupOf(closed.filter((item) => String(item.trade.direction).toLowerCase() === "short"));
    const check = (weak, strong, name) => {
      if (weak.closed >= 5 && strong.closed >= 3 && weak.net < 0 && strong.net > 0) {
        add({
          id: `direction_${name}`,
          kind: "money",
          title: `${name === "long" ? "Long" : "Short"} trades are losing while the other side makes money`,
          detail: `${plural(weak.closed, `closed ${name} trade`)} netted ${money(weak.net)}, while ${plural(strong.closed, `closed ${name === "long" ? "short" : "long"} trade`)} netted ${money(strong.net)}.`,
          amount: round2(weak.net),
          count: weak.closed,
          trades: refs(weak.closedItems),
          fix: `Check what separates your good ${name === "long" ? "short" : "long"} setups from your ${name} ones. Either add that filter to your rules or stop taking ${name}s until you can name it.`,
        });
      }
    };
    check(longs, shorts, "long");
    check(shorts, longs, "short");
  }

  /* ---------- 9. the trader's own checkbox properties: the answer that is losing money ---------- */
  {
    const boxes = new Map();
    for (const item of items) {
      for (const field of item.trade.customFields ?? []) {
        if (field.type !== "checkbox") continue;
        const entry = boxes.get(field.label) ?? { yes: [], no: [] };
        if (field.value === true) entry.yes.push(item);
        else if (field.value === false) entry.no.push(item); // an empty/unknown value is left out, never counted as "no"
        boxes.set(field.label, entry);
      }
    }
    const splits = [];
    for (const [label, { yes, no }] of boxes) {
      const yesGroup = groupOf(yes);
      const noGroup = groupOf(no);
      if (yesGroup.closed < 3 || noGroup.closed < 3) continue;
      const [weak, strong, answer, other] = yesGroup.net < noGroup.net ? [yesGroup, noGroup, "yes", "no"] : [noGroup, yesGroup, "no", "yes"];
      if (weak.net >= 0 || !notBetterThan(weak, strong)) continue;
      splits.push({ label, weak, strong, answer, other, trades: answer === "yes" ? yes : no });
    }
    splits.sort((a, b) => a.weak.net - b.weak.net);
    for (const split of splits.slice(0, 1)) {
      add({
        id: `property_${split.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30)}`,
        kind: "money",
        title: `Trades where "${split.label}" is ${split.answer}`,
        detail: `${plural(split.weak.closed, "closed trade")} marked "${split.label}" = ${split.answer} netted ${money(split.weak.net)}${split.weak.avgR !== null ? ` (${split.weak.avgR.toFixed(2)}R average)` : ""}, while ${plural(split.strong.closed, "closed trade")} marked ${split.other} netted ${money(split.strong.net)}${split.strong.avgR !== null ? ` (${split.strong.avgR.toFixed(2)}R average)` : ""}. Trades with this property left blank are not counted.`,
        amount: round2(split.weak.net),
        count: split.weak.closed,
        trades: refs(split.trades),
        fix: `Your own property splits your results. Decide whether "${split.label}" should be a must-have (or must-not) before entry, and write it into your plan.`,
      });
    }
  }

  /* ---------- 10. days with no written plan (only when a planner is connected) ---------- */
  if (planEntries) {
    const plannedDays = new Set(planEntries.map((entry) => entry.date));
    const planned = groupOf(items.filter((item) => plannedDays.has(item.day)));
    const unplannedItems = items.filter((item) => !plannedDays.has(item.day));
    const unplanned = groupOf(unplannedItems);
    if (planned.closed >= 3 && unplanned.closed >= 3 && unplanned.net < 0 && planned.net > unplanned.net && notBetterThan(unplanned, planned)) {
      add({
        id: "unplanned_days",
        kind: "money",
        title: "Trades on days with no written plan",
        detail: `${plural(unplanned.closed, "closed trade")} on days without a plan netted ${money(unplanned.net)}${unplanned.avgR !== null ? ` (${unplanned.avgR.toFixed(2)}R average)` : ""}, while ${plural(planned.closed, "closed trade")} on planned days netted ${money(planned.net)}${planned.avgR !== null ? ` (${planned.avgR.toFixed(2)}R average)` : ""}. This compares days only; it does not check that a trade matched its plan.`,
        amount: round2(unplanned.net),
        count: unplanned.closed,
        trades: refs(unplannedItems.filter((item) => item.pnl !== null)),
        fix: "Write the plan before the session opens, even three lines: setup, stop, size. No plan, no entry.",
      });
    }
  }

  /* ---------- 11. no notes: the review time you pay for and cannot use (time, not measurable in money) ---------- */
  {
    const missing = items.filter((item) => !hasNote(item.trade));
    if (items.length >= 5 && missing.length / items.length >= 0.5) {
      add({
        id: "no_notes",
        kind: "time",
        title: "Most trades have no written note",
        detail: `${missing.length} of ${items.length} trades have no note. Without the reason for an entry or exit, reviewing them later takes longer and teaches you less, and the mentor cannot tell a plan from an impulse.`,
        amount: null,
        count: missing.length,
        trades: refs(missing),
        fix: "One line per trade, written right after the exit: why you entered, and what you would repeat or change.",
      });
    }
  }

  // measured money first (largest loss first), then the ones that cannot be measured in money
  found.sort((a, b) => {
    if (a.amount === null && b.amount === null) return 0;
    if (a.amount === null) return 1;
    if (b.amount === null) return -1;
    return a.amount - b.amount;
  });

  return { ...base, items: found.slice(0, MAX_ITEMS) };
};

/** The leak report as prompt lines, so the AI explains the same numbers the trader will see. */
export const leakReportLines = (report, currency) => {
  if (!report) return [];
  if (report.tooFewTrades) return ["too few closed trades to measure money or time leaks (fewer than 3)"];
  const lines = [];
  if (report.orderChecksSkipped) lines.push("order-based leak checks (re-entries, trades after a loss, busy days) were skipped because many trades share one date");
  if (!report.items.length) {
    lines.push("no money or time leak was found by the automatic checks in these trades");
    return lines;
  }
  report.items.forEach((item, index) => {
    const cost = item.amount === null ? "cost not measurable in money" : `${item.amount < 0 ? "-" : "+"}${currency} ${Math.abs(item.amount).toFixed(2)} net over ${item.count} trade(s)`;
    lines.push(`${index + 1}. [${item.id}] ${item.title}: ${cost}${item.trades.length ? ` (${item.trades.join(", ")})` : ""}`);
    lines.push(`   ${item.detail}`);
  });
  return lines;
};
