// Server-side twin of frontend/src/utils/tradeAnalytics.js, so the AI mentor reads exactly the same numbers the
// Analysis tab shows (win rate, profit factor, expectancy, avg R, drawdown, streaks, long vs short).
// Works on lean Mongo trade documents. Pure functions, no I/O.

const num = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isShort = (trade) => String(trade.direction ?? "").toLowerCase() === "short";

export const tradePnl = (trade) => {
  const entry = num(trade.entryPrice);
  const exit = num(trade.exitPrice);
  const quantity = num(trade.quantity);
  if (entry === null || exit === null || quantity === null) return null;
  return (exit - entry) * (isShort(trade) ? -1 : 1) * quantity;
};

export const tradeRisk = (trade) => {
  const entry = num(trade.entryPrice);
  const stop = num(trade.stopLoss);
  const quantity = num(trade.quantity);
  if (entry === null || stop === null || quantity === null) return null;
  const risk = Math.abs(entry - stop) * quantity;
  return risk > 0 ? risk : null;
};

export const tradeR = (trade) => {
  const pnl = tradePnl(trade);
  const risk = tradeRisk(trade);
  return pnl === null || risk === null ? null : pnl / risk;
};

/* ------------------------------ dates ------------------------------ */

export const dateKey = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

export const isDateKey = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

export const addDays = (key, days) => {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Monday of the week that contains `key` (weeks run Monday to Sunday). */
export const mondayOf = (key) => {
  const day = new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(key, -((day + 6) % 7));
};

/* ----------------------------- analytics ----------------------------- */

const sum = (values) => values.reduce((total, value) => total + value, 0);

const longestRun = (flags) => {
  let best = 0;
  let current = 0;
  for (const flag of flags) {
    current = flag ? current + 1 : 0;
    if (current > best) best = current;
  }
  return best;
};

const sideSummary = (closed) => {
  const wins = closed.filter((item) => item.pnl > 0);
  return {
    count: closed.length,
    netPnl: sum(closed.map((item) => item.pnl)),
    winRate: closed.length ? wins.length / closed.length : null,
  };
};

export const computeAnalytics = (trades) => {
  const closed = trades
    .map((trade, index) => ({ trade, index, pnl: tradePnl(trade), r: tradeR(trade), key: dateKey(trade.date) }))
    .filter((item) => item.pnl !== null)
    .sort((a, b) => (a.key === b.key ? a.index - b.index : a.key < b.key ? -1 : 1));

  const pnls = closed.map((item) => item.pnl);
  const wins = pnls.filter((value) => value > 0);
  const losses = pnls.filter((value) => value < 0);
  const grossProfit = sum(wins);
  const grossLoss = Math.abs(sum(losses));
  const netPnl = sum(pnls);

  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of pnls) {
    running += value;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
  }

  const rValues = closed.map((item) => item.r).filter((value) => value !== null);
  const winR = closed.filter((item) => item.pnl > 0 && item.r !== null).map((item) => item.r);
  const lossR = closed.filter((item) => item.pnl < 0 && item.r !== null).map((item) => item.r);
  const avgWinR = winR.length ? sum(winR) / winR.length : null;
  const avgLossR = lossR.length ? Math.abs(sum(lossR) / lossR.length) : null; // shown as a positive size
  const expectancyR = rValues.length ? sum(rValues) / rValues.length : null;
  const avgWin = wins.length ? grossProfit / wins.length : null;
  const avgLoss = losses.length ? grossLoss / losses.length : null;
  const side = (name) => sideSummary(closed.filter((item) => (isShort(item.trade) ? "short" : "long") === name));

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.length - closed.length,
    wins: wins.length,
    losses: losses.length,
    netPnl,
    winRate: closed.length ? wins.length / closed.length : null,
    expectancy: closed.length ? netPnl / closed.length : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null, // null = no losing trade yet (undefined / infinite)
    // Average R per trade = EXPECTANCY in R. It is not a reward-to-risk ratio.
    expectancyR,
    avgRrr: expectancyR, // legacy name kept so reviews saved earlier still read; always means expectancyR
    rrrSample: rValues.length,
    avgWinR,
    avgLossR,
    // Reward-to-risk = average winner / average loser, both in R (needs stops). Null when there is no winner or loser with a stop.
    rewardRisk: avgWinR !== null && avgLossR !== null && avgLossR > 0 ? avgWinR / avgLossR : null,
    avgWin,
    avgLoss,
    payoffRatio: avgWin !== null && avgLoss !== null ? avgWin / avgLoss : null,
    bestTrade: closed.length ? Math.max(...pnls) : null,
    worstTrade: closed.length ? Math.min(...pnls) : null,
    maxDrawdown,
    winStreak: longestRun(pnls.map((value) => value > 0)),
    lossStreak: longestRun(pnls.map((value) => value < 0)),
    long: side("long"),
    short: side("short"),
  };
};

/* --------------------- behaviour evidence for one week --------------------- */

const groupNet = (closed, pick) => {
  const groups = new Map();
  for (const item of closed) {
    const name = pick(item.trade);
    const entry = groups.get(name) ?? { name, trades: 0, net: 0, wins: 0 };
    entry.trades += 1;
    entry.net += item.pnl;
    if (item.pnl > 0) entry.wins += 1;
    groups.set(name, entry);
  }
  return [...groups.values()].sort((a, b) => b.trades - a.trades);
};

const hasNote = (trade) => String(trade.analysis ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim().length > 0;

/**
 * Facts that can be checked without any AI: did the trader log stops, size risk consistently, overtrade,
 * trade again after a same-day loss, let a loser run past 1R, write notes, tick their own checkbox properties.
 * The model gets these as ground truth next to the raw trades, so it doesn't have to guess at them.
 */
export const computeWeekEvidence = (weekTrades) => {
  const ordered = [...weekTrades].sort((a, b) => {
    const byDay = dateKey(a.date).localeCompare(dateKey(b.date));
    return byDay || new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0);
  });

  const items = ordered.map((trade) => ({ trade, pnl: tradePnl(trade), r: tradeR(trade), risk: tradeRisk(trade) }));
  const closed = items.filter((item) => item.pnl !== null);

  const withStop = items.filter((item) => item.risk !== null);
  const risks = withStop.map((item) => item.risk);

  const perDay = new Map();
  let afterSameDayLoss = 0;
  const lossSeenOn = new Set();
  for (const item of items) {
    const day = dateKey(item.trade.date);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    if (lossSeenOn.has(day)) afterSameDayLoss += 1;
    if (item.pnl !== null && item.pnl < 0) lossSeenOn.add(day);
  }

  // checkbox properties (e.g. "Followed plan?") summarised across the week's trades
  const checkboxes = new Map();
  for (const { trade, r } of items) {
    for (const field of trade.customFields ?? []) {
      if (field.type !== "checkbox") continue;
      const entry = checkboxes.get(field.label) ?? { label: field.label, yes: 0, no: 0, unknown: 0, yesR: [], noR: [] };
      if (field.value === true) {
        entry.yes += 1;
        if (r !== null) entry.yesR.push(r);
      } else if (field.value === false) {
        entry.no += 1;
        if (r !== null) entry.noR.push(r);
      } else entry.unknown += 1;
      checkboxes.set(field.label, entry);
    }
  }
  const averageR = (values) => (values.length ? sum(values) / values.length : null);
  const checkboxSummaries = [...checkboxes.values()].map(({ yesR, noR, ...box }) => ({
    ...box,
    yesClosed: yesR.length,
    noClosed: noR.length,
    yesAvgR: averageR(yesR),
    noAvgR: averageR(noR),
  }));

  return {
    tradeCount: items.length,
    closedCount: closed.length,
    openCount: items.length - closed.length,
    stopLossLogged: withStop.length,
    riskPerTrade: risks.length ? { avg: sum(risks) / risks.length, min: Math.min(...risks), max: Math.max(...risks) } : null,
    daysTraded: perDay.size,
    maxTradesInOneDay: perDay.size ? Math.max(...perDay.values()) : 0,
    tradesTakenAfterSameDayLoss: afterSameDayLoss,
    lossesBeyondOneAndAHalfR: closed.filter((item) => item.r !== null && item.r < -1.5).length,
    tradesWithNotes: items.filter((item) => hasNote(item.trade)).length,
    checkboxProperties: checkboxSummaries,
    byDirection: groupNet(closed, (trade) => (isShort(trade) ? "short" : "long")),
    byAsset: groupNet(closed, (trade) => String(trade.assetName ?? "unknown")).slice(0, 8),
  };
};

/** Compact per-week table for the weeks before the one being reviewed. */
export const weeklyHistory = (trades, beforeWeekStart, weeks = 8) => {
  const rows = [];
  for (let offset = weeks; offset >= 1; offset -= 1) {
    const start = addDays(beforeWeekStart, -7 * offset);
    const end = addDays(start, 6);
    const inWeek = trades.filter((trade) => {
      const key = dateKey(trade.date);
      return key >= start && key <= end;
    });
    if (!inWeek.length) continue;
    const stats = computeAnalytics(inWeek);
    rows.push({ weekStart: start, trades: stats.totalTrades, closed: stats.closedTrades, net: stats.netPnl, winRate: stats.winRate, expectancyR: stats.expectancyR });
  }
  return rows;
};

/* --------------------- the numbers a summary card shows --------------------- */

/** One shape for the stats saved with a review and shown above it (weekly and date range alike). */
export const summaryStats = (trades) => {
  const stats = computeAnalytics(trades);
  return {
    trades: stats.totalTrades,
    closed: stats.closedTrades,
    netPnl: stats.netPnl,
    winRate: stats.winRate,
    expectancyR: stats.expectancyR,
    rewardRisk: stats.rewardRisk,
    payoffRatio: stats.payoffRatio,
    avgRrr: stats.expectancyR, // legacy alias, same value as expectancyR
  };
};

/* ------------------- anti-edge evidence (what costs the edge) ------------------- */

const wilson = (wins, n, z = 1.96) => {
  if (!n) return null;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
};

const groupStats = (items) => {
  const closed = items.filter((item) => item.pnl !== null);
  const rs = closed.map((item) => item.r).filter((value) => value !== null);
  return {
    count: items.length,
    closed: closed.length,
    net: sum(closed.map((item) => item.pnl)),
    wins: closed.filter((item) => item.pnl > 0).length,
    avgR: rs.length ? sum(rs) / rs.length : null,
  };
};

/** Sample size honesty: how much weight a number can carry. Under 30 closed trades nothing is more than an early read. */
export const sampleStrength = (closedCount) => (closedCount < 30 ? "early" : closedCount < 100 ? "building" : "solid");

const sameAsset = (a, b) => String(a.assetName ?? "").trim().toLowerCase() === String(b.assetName ?? "").trim().toLowerCase();

/**
 * Facts for the anti-edge part of the review, computed from the logs so the model never has to guess:
 * how reliable the sample is, trades opened again on the same instrument after a stop-out, trades taken after a
 * same-day loss, results with and without each checkbox property ticked, risk-size spread, and (when a planner
 * is connected) results on days that had a plan versus days that did not.
 * `labelOf(trade)` returns the T-number the prompt uses for a trade, or null for trades listed without one.
 */
export const computeLeakEvidence = (trades, { planEntries = null, labelOf = () => null } = {}) => {
  const ordered = [...trades].sort((a, b) => {
    const byDay = dateKey(a.date).localeCompare(dateKey(b.date));
    return byDay || new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0);
  });
  const items = ordered.map((trade) => ({ trade, day: dateKey(trade.date), pnl: tradePnl(trade), r: tradeR(trade), risk: tradeRisk(trade), label: labelOf(trade) }));
  const closed = items.filter((item) => item.pnl !== null);
  const wins = closed.filter((item) => item.pnl > 0).length;

  // re-entries: a trade on an instrument that already lost earlier the same day (and was not itself the first entry)
  const reEntryItems = [];
  const chains = new Map();
  items.forEach((item, index) => {
    const earlier = items.slice(0, index).filter((other) => other.day === item.day && sameAsset(other.trade, item.trade));
    if (!earlier.length) return;
    const lastEarlier = earlier[earlier.length - 1];
    if (lastEarlier.pnl === null || lastEarlier.pnl >= 0) return; // only after a loss: re-entry after a win is a different thing
    reEntryItems.push(item);
    const key = `${item.day}|${String(item.trade.assetName ?? "").trim().toLowerCase()}`;
    const chain = chains.get(key) ?? { day: item.day, asset: item.trade.assetName, entries: [] };
    chain.entries = [...earlier, item].map((e) => e.label ?? "(no T-number)");
    chain.count = earlier.length + 1;
    chain.reEntries = (chain.reEntries ?? 0) + 1;
    chain.net = sum([...earlier, item].filter((e) => e.pnl !== null).map((e) => e.pnl));
    chains.set(key, chain);
  });

  const reEntrySet = new Set(reEntryItems);
  const afterLossItems = [];
  const lossDays = new Set();
  for (const item of items) {
    if (lossDays.has(item.day)) afterLossItems.push(item);
    if (item.pnl !== null && item.pnl < 0) lossDays.add(item.day);
  }

  // checkbox properties: result when ticked vs not ticked
  const boxes = new Map();
  for (const item of items) {
    for (const field of item.trade.customFields ?? []) {
      if (field.type !== "checkbox") continue;
      const entry = boxes.get(field.label) ?? { label: field.label, yes: [], no: [], unknown: [] };
      if (field.value === true) entry.yes.push(item);
      else if (field.value === false) entry.no.push(item);
      else entry.unknown.push(item);
      boxes.set(field.label, entry);
    }
  }
  const checkboxSplits = [...boxes.values()].map((box) => ({ label: box.label, ticked: groupStats(box.yes), notTicked: groupStats(box.no), unknown: groupStats(box.unknown) }));

  const risks = items.map((item) => item.risk).filter((value) => value !== null);
  const days = new Set(items.map((item) => item.day));

  let planSplit = null;
  if (planEntries) {
    const plannedDays = new Set(planEntries.map((entry) => entry.date));
    planSplit = {
      plannedDays: plannedDays.size,
      onPlannedDays: groupStats(items.filter((item) => plannedDays.has(item.day))),
      onUnplannedDays: groupStats(items.filter((item) => !plannedDays.has(item.day))),
    };
  }

  return {
    closedCount: closed.length,
    strength: sampleStrength(closed.length),
    winRateRange: wilson(wins, closed.length),
    lookedBackfilled: items.length >= 8 && days.size === 1, // many trades, one date: probably logged after the fact (backtest or catch-up)
    reEntry: { count: reEntryItems.length, group: groupStats(reEntryItems), rest: groupStats(items.filter((item) => !reEntrySet.has(item))), chains: [...chains.values()] },
    afterLoss: { group: groupStats(afterLossItems), rest: groupStats(items.filter((item) => !afterLossItems.includes(item))) },
    checkboxSplits,
    riskSpread: risks.length ? { min: Math.min(...risks), max: Math.max(...risks), ratio: Math.min(...risks) > 0 ? Math.max(...risks) / Math.min(...risks) : null } : null,
    planSplit,
  };
};
