// Turns a journal + its trades into the plain data every exporter (CSV, JSON, Excel, PDF, ZIP) shares,
// so all formats always agree on columns, P&L and summary numbers.

const ENTITIES = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Readable plain text from the editor's HTML (lists become "•" lines, images are dropped). */
export const htmlToText = (html) => {
  if (typeof html !== "string" || !html) return "";
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|blockquote|ul|ol|li|tr)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      const lower = entity.toLowerCase();
      if (lower in ENTITIES) return ENTITIES[lower];
      try {
        if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16));
        if (lower.startsWith("#")) return String.fromCodePoint(parseInt(lower.slice(1), 10));
      } catch {
        return match;
      }
      return match;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}(?=• )/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const imageUrlsFromHtml = (html = "") =>
  [...String(html).matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1].trim()).filter(Boolean);

const toNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const round = (value, digits = 2) => (Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);

const dateKey = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

const customValue = (field) => {
  const value = field?.value;
  if (value === null || value === undefined) return "";
  if (field.type === "checkbox") return value ? "Yes" : "No";
  return typeof value === "number" ? value : String(value);
};

export const BASE_COLUMNS = [
  { header: "Date", type: "date", width: 12 },
  { header: "Asset", type: "text", width: 16 },
  { header: "Direction", type: "text", width: 11 },
  { header: "Quantity", type: "number", width: 11 },
  { header: "Entry Price", type: "number", width: 13 },
  { header: "Exit Price", type: "number", width: 13 },
  { header: "Stop Loss", type: "number", width: 12 },
  { header: "Status", type: "text", width: 9 },
  { header: "P&L", type: "money", width: 13 },
  { header: "R Multiple", type: "r", width: 11 },
];

const TAIL_COLUMNS = [
  { header: "Analysis", type: "long", width: 60 },
  { header: "Screenshots", type: "number", width: 12 },
  { header: "Screenshot URLs", type: "long", width: 40 },
  { header: "Logged At", type: "text", width: 22 },
];

const computeSummary = (trades) => {
  const closed = trades.filter((trade) => trade.pnl !== null);
  const wins = closed.filter((trade) => trade.pnl > 0);
  const losses = closed.filter((trade) => trade.pnl < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  const rValues = trades.map((trade) => trade.rMultiple).filter((value) => value !== null);

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.length - closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? round(wins.length / closed.length, 4) : null,
    netPnl: round(closed.reduce((sum, trade) => sum + trade.pnl, 0)),
    grossProfit: round(grossProfit),
    grossLoss: round(grossLoss),
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : null,
    averageR: rValues.length ? round(rValues.reduce((sum, value) => sum + value, 0) / rValues.length) : null,
    bestTrade: closed.length ? round(Math.max(...closed.map((trade) => trade.pnl))) : null,
    worstTrade: closed.length ? round(Math.min(...closed.map((trade) => trade.pnl))) : null,
  };
};

/**
 * @param {object} journal  lean Journal document
 * @param {object[]} trades lean Trade documents (oldest first)
 * @param {{preset:string,label:string,from:string|null,to:string|null}} range
 */
export const buildExportData = ({ journal, trades, range, defaultCurrency = "USD" }) => {
  const structured = trades.map((trade) => {
    const entry = toNumber(trade.entryPrice);
    const exit = toNumber(trade.exitPrice);
    const quantity = toNumber(trade.quantity) ?? 0;
    const stop = toNumber(trade.stopLoss);
    const direction = trade.direction === "short" ? "Short" : "Long";
    const pnl = entry !== null && exit !== null ? (exit - entry) * (direction === "Short" ? -1 : 1) * quantity : null;
    const risk = entry !== null && stop !== null ? Math.abs(entry - stop) * quantity : 0;
    const images = [...new Set([...(Array.isArray(trade.images) ? trade.images : []), ...imageUrlsFromHtml(trade.analysis)])];

    return {
      id: String(trade._id),
      date: dateKey(trade.date),
      asset: trade.assetName ?? "",
      direction,
      quantity,
      entryPrice: entry,
      exitPrice: exit,
      stopLoss: stop,
      status: exit === null ? "Open" : "Closed",
      pnl: round(pnl),
      rMultiple: pnl !== null && risk > 0 ? round(pnl / risk) : null,
      analysis: htmlToText(trade.analysis),
      analysisHtml: trade.analysis ?? "",
      images,
      customFields: (Array.isArray(trade.customFields) ? trade.customFields : []).map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        value: field.value ?? null,
      })),
      loggedAt: trade.createdAt ? new Date(trade.createdAt).toISOString() : "",
    };
  });

  // one column per custom property, named after its label (made unique if two share a name)
  const used = new Set([...BASE_COLUMNS, ...TAIL_COLUMNS].map((column) => column.header));
  const customColumns = new Map();
  for (const trade of structured) {
    for (const field of trade.customFields) {
      if (customColumns.has(field.key)) continue;
      const base = String(field.label || field.key || "Property").trim();
      let header = base;
      if (used.has(header)) header = `${base} (custom)`;
      for (let n = 2; used.has(header); n += 1) header = `${base} (${n})`;
      used.add(header);
      customColumns.set(field.key, { header, type: field.type === "number" ? "number" : "text", width: 16 });
    }
  }

  const columns = [...BASE_COLUMNS, ...customColumns.values(), ...TAIL_COLUMNS];

  const rows = structured.map((trade) => {
    const row = {
      Date: trade.date,
      Asset: trade.asset,
      Direction: trade.direction,
      Quantity: trade.quantity,
      "Entry Price": trade.entryPrice ?? "",
      "Exit Price": trade.exitPrice ?? "",
      "Stop Loss": trade.stopLoss ?? "",
      Status: trade.status,
      "P&L": trade.pnl ?? "",
      "R Multiple": trade.rMultiple ?? "",
    };
    const byKey = new Map(trade.customFields.map((field) => [field.key, field]));
    for (const [key, column] of customColumns) row[column.header] = byKey.has(key) ? customValue(byKey.get(key)) : "";
    row.Analysis = trade.analysis;
    row.Screenshots = trade.images.length;
    row["Screenshot URLs"] = trade.images.join("\n");
    row["Logged At"] = trade.loggedAt;
    return row;
  });

  const context = journal.context ?? {};
  return {
    generatedAt: new Date().toISOString(),
    journal: {
      id: String(journal._id),
      name: journal.journalName,
      description: journal.description ?? "",
      currency: journal.currency || defaultCurrency,
      strategy: htmlToText(context.strategy),
      strategyHtml: context.strategy ?? "",
      defaultProperties: (context.attributes ?? []).map(({ key, label, type, value }) => ({ key, label, type, value: value ?? null })),
    },
    range: { preset: range.preset, label: range.label, from: range.from, to: range.to },
    summary: computeSummary(structured),
    columns,
    rows,
    trades: structured,
  };
};
