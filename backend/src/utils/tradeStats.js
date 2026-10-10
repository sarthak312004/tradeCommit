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
    avgRrr: rValues.length ? sum(rValues) / rValues.length : null,
    rrrSample: rValues.length,
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
  for (const { trade } of items) {
    for (const field of trade.customFields ?? []) {
      if (field.type !== "checkbox") continue;
      const entry = checkboxes.get(field.label) ?? { label: field.label, yes: 0, no: 0 };
      if (field.value === true) entry.yes += 1;
      else entry.no += 1;
      checkboxes.set(field.label, entry);
    }
  }

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
    checkboxProperties: [...checkboxes.values()],
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
    rows.push({ weekStart: start, trades: stats.totalTrades, closed: stats.closedTrades, net: stats.netPnl, winRate: stats.winRate, avgRrr: stats.avgRrr });
  }
  return rows;
};
