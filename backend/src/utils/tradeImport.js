import { ApiError } from "./ApiError.js";

// Reads a broker / spreadsheet trade log (CSV or XLSX) and turns it into trades the journal understands.
//
//  1. readRows()          file bytes   -> rows of plain cells
//  2. buildPreview()      rows         -> candidate trades, each tagged intraday / delivery / unclassified
//  3. sanitizeImportTrade() one trade the user reviewed -> a clean payload for the Trade model
//
// Two file shapes are understood:
//  - "trades":     one row = one trade (date, symbol, direction, qty, entry price, optional exit price / stop)
//                  this includes TradeCommit's own export
//  - "executions": one row = one buy or sell fill (broker tradebooks). Fills are paired first-in-first-out per symbol
//                  into round trips; what is left over becomes an open trade.

export const MAX_FILE_ROWS = 20000;
export const MAX_IMPORT_TRADES = 1000;
export const TRADE_TYPE_LABELS = { intraday: "Intraday", delivery: "Delivery" };
export const TRADE_TYPE_FIELD = { key: "trade-type", label: "Trade type", type: "text" };
export const EXIT_DATE_FIELD = { key: "exit-date", label: "Exit date", type: "date" };

/* ------------------------------------------------------------------ reading */

/** Minimal RFC 4180 reader: quotes, escaped quotes, embedded newlines, BOM, and , ; or tab as the delimiter. */
export const parseCsv = (input) => {
  let text = String(input ?? "").replace(/^\uFEFF/, "");
  let delimiter = null;

  const sep = text.match(/^sep=(.)\r?\n/i);
  if (sep) {
    delimiter = sep[1];
    text = text.slice(sep[0].length);
  }
  if (!delimiter) {
    const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? "";
    const counts = [",", ";", "\t"].map((candidate) => [candidate, firstLine.split(candidate).length - 1]);
    counts.sort((a, b) => b[1] - a[1]);
    delimiter = counts[0][1] > 0 ? counts[0][0] : ",";
  }

  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === "\n") {
      endRow();
    } else if (char === "\r") {
      if (text[i + 1] === "\n") i += 1;
      endRow();
    } else {
      cell += char;
    }
    if (rows.length > MAX_FILE_ROWS + 50) break;
  }
  if (cell !== "" || row.length > 0) endRow();

  return rows;
};

// exceljs cells can be strings, numbers, dates, booleans or objects (formulas, rich text, hyperlinks)
const plainCell = (value) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "object") {
    if ("result" in value) return plainCell(value.result);
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
    if ("text" in value) return plainCell(value.text);
    if ("error" in value) return null;
  }
  return String(value);
};

const readXlsxRows = async (buffer) => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new ApiError(400, "This Excel file could not be read. Re-save it as .xlsx or export it as CSV.");
  }

  // the first sheet that actually has data
  const sheet = workbook.worksheets.find((candidate) => candidate.actualRowCount > 0);
  if (!sheet) throw new ApiError(400, "This Excel file has no data.");

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    if (rows.length > MAX_FILE_ROWS + 50) return;
    const cells = [];
    for (let column = 1; column <= row.cellCount; column += 1) cells.push(plainCell(row.getCell(column).value));
    if (cells.some((cell) => cell !== null && String(cell).trim() !== "")) rows.push(cells);
  });
  return rows;
};

const decodeText = (buffer) => {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.toString("utf16le");
  return buffer.toString("utf8");
};

/** Reads a .csv / .xlsx upload into rows of cells. The header row is found later, so notes above it are fine. */
export const readRows = async (buffer, fileName = "") => {
  const name = String(fileName).toLowerCase();
  if (name.endsWith(".xls")) {
    throw new ApiError(400, "Old .xls files are not supported. Save the file as .xlsx or .csv and try again.");
  }

  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const rows = isZip || name.endsWith(".xlsx") ? await readXlsxRows(buffer) : parseCsv(decodeText(buffer));

  if (rows.length === 0) throw new ApiError(400, "This file has no rows to import.");
  if (rows.length > MAX_FILE_ROWS) throw new ApiError(400, `This file has more than ${MAX_FILE_ROWS} rows. Split it and import in parts.`);
  return rows;
};

/* ------------------------------------------------------------ column mapping */

const norm = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIASES = {
  date: ["date", "tradedate", "entrydate", "opendate", "opendatetime", "datetime", "timestamp", "executiondate", "executiontime", "orderexecutiontime", "transactiondate", "tradetime", "entrytime", "boughton", "tradebookdate", "businessdate", "orderdate", "filledat", "executedat"],
  exitDate: ["exitdate", "closedate", "closingdate", "closedatetime", "exittime", "closetime", "selldate", "soldon"],
  symbol: ["symbol", "asset", "assetname", "instrument", "instrumentname", "scrip", "scripname", "stock", "stockname", "ticker", "security", "contract", "tradingsymbol", "script", "tradingsymbolname", "underlying", "symbolname", "company", "companyname"],
  side: ["side", "direction", "buysell", "action", "transactiontype", "transaction", "bs", "tradetype", "type", "position", "buyorsell", "orderaction", "tradeaction"],
  quantity: ["quantity", "qty", "shares", "size", "units", "tradedqty", "tradedquantity", "filledqty", "filledquantity", "volume", "noofshares", "netqty", "netquantity", "executedqty", "executedquantity", "filledsize", "lots", "lotqty"],
  price: ["price", "tradeprice", "avgprice", "averageprice", "rate", "executionprice", "filledprice", "executedprice", "tradedprice", "averageexecutionprice", "fillprice", "averagefillprice"],
  entry: ["entryprice", "entry", "buyprice", "openprice", "avgentryprice", "averageentryprice", "entryrate", "avgbuyprice", "buyaverage", "buyavg"],
  exit: ["exitprice", "exit", "sellprice", "closeprice", "closingprice", "avgexitprice", "averageexitprice", "exitrate", "avgsellprice", "sellaverage", "sellavg"],
  stop: ["stoploss", "stop", "sl", "stoplossprice", "stopprice", "stoplevel"],
  product: ["product", "producttype", "tradekind", "kind", "holdingtype", "tradestyle", "style", "intradaydelivery", "category"],
  notes: ["notes", "note", "remarks", "remark", "comment", "comments", "analysis", "description", "reason", "rationale"],
};

const SIDE_WORDS = /^(buy|b|bought|purchase|long|sell|s|sold|short|sale)$/;
const KIND_WORDS = /^(intraday|intra day|day|mis|cnc|delivery|d|i|btst|stbt|nrml|swing|positional|carry|overnight|mtf|bo|co)$/;

const looksLike = (values, pattern) => {
  const filled = values.map((value) => String(value ?? "").trim().toLowerCase()).filter(Boolean);
  if (filled.length === 0) return 0;
  return filled.filter((value) => pattern.test(value)).length / filled.length;
};

const findHeader = (rows) => {
  const scan = Math.min(rows.length, 25);
  let best = null;
  for (let index = 0; index < scan; index += 1) {
    const names = rows[index].map(norm);
    const score = Object.values(ALIASES).filter((aliases) => names.some((name) => aliases.includes(name))).length;
    if (score >= 3 && (!best || score > best.score)) best = { index, score };
  }
  return best?.index ?? -1;
};

const mapColumns = (header, body, mapping = null) => {
  const names = header.map(norm);
  const columns = {};
  const taken = new Set();

  // most specific roles first so "Exit Date" is not mistaken for the trade date
  for (const role of ["exitDate", "entry", "exit", "stop", "date", "symbol", "quantity", "price", "side", "product", "notes"]) {
    const index = names.findIndex((name, position) => !taken.has(position) && ALIASES[role].includes(name));
    if (index >= 0) {
      columns[role] = index;
      taken.add(index);
    }
  }

  if (columns.side === undefined) {
    const sideIndex = header.findIndex((_, index) => looksLike(body.slice(0, 200).map((row) => row[index]), SIDE_WORDS) >= 0.6);
    if (sideIndex >= 0) columns.side = sideIndex;
  }

  // a second date-like column (e.g. "Order execution time") only supplies the time of day, to order same-day fills
  const timeIndex = names.findIndex((name, position) => !taken.has(position) && ALIASES.date.includes(name));
  if (timeIndex >= 0) columns.time = timeIndex;

  // "Trade type" / "Type" can hold Buy/Sell or Intraday/Delivery: decide from the values
  if (columns.side !== undefined) {
    const values = body.slice(0, 200).map((row) => row[columns.side]);
    if (looksLike(values, SIDE_WORDS) < 0.6 && looksLike(values, KIND_WORDS) >= 0.6) {
      if (columns.product === undefined) columns.product = columns.side;
      delete columns.side;
    }
  }

  if (mapping && typeof mapping === "object") {
    for (const role of ["date", "exitDate", "symbol", "side", "quantity", "price", "entry", "exit", "stop", "product", "notes", "time"]) {
      if (!Object.hasOwn(mapping, role)) continue;
      const index = Number(mapping[role]);
      if (mapping[role] === "" || mapping[role] === null || !Number.isInteger(index) || index < 0 || index >= header.length) {
        delete columns[role];
      } else {
        columns[role] = index;
      }
    }
  }
  return columns;
};

/* -------------------------------------------------------------- cell parsing */

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

const pad = (value) => String(value).padStart(2, "0");

const buildDate = (year, month, day, hour = 0, minute = 0, second = 0) => {
  const y = year < 100 ? 2000 + year : year;
  const stamp = Date.UTC(y, month - 1, day, hour, minute, second);
  const check = new Date(stamp);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  if (y < 1990 || y > 2100) return null;
  return { key: `${y}-${pad(month)}-${pad(day)}`, ts: hour || minute || second ? stamp : null };
};

const withMeridiem = (hour, meridiem) => {
  if (!meridiem) return hour;
  const pm = meridiem.toLowerCase() === "pm";
  return (hour % 12) + (pm ? 12 : 0);
};

const TIME = "(?:[T\\s,]+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?(?:\\.\\d+)?\\s*(AM|PM)?)?";
const ISO_RE = new RegExp(`^(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})${TIME}`, "i");
const NUMERIC_RE = new RegExp(`^(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{2,4})${TIME}`, "i");
const DAY_MONTH_NAME_RE = new RegExp(`^(\\d{1,2})[-\\s/]([A-Za-z]{3,9})\\.?[-\\s/,]*(\\d{2,4})${TIME}`, "i");
const MONTH_NAME_DAY_RE = new RegExp(`^([A-Za-z]{3,9})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})${TIME}`, "i");

/** Decides whether a column of numeric dates is day-first (15/03/2024) or month-first; day-first when it cannot tell. */
const detectDayFirst = (values) => {
  let dayFirst = null;
  for (const value of values) {
    const match = typeof value === "string" ? value.trim().match(NUMERIC_RE) : null;
    if (!match) continue;
    if (Number(match[1]) > 12) return true;
    if (Number(match[2]) > 12) dayFirst = false;
  }
  return dayFirst ?? true;
};

const parseDateCell = (value, dayFirst) => {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const hasTime = value.getUTCHours() || value.getUTCMinutes() || value.getUTCSeconds();
    return { key: value.toISOString().slice(0, 10), ts: hasTime ? value.getTime() : null };
  }

  // Excel serial date
  if (typeof value === "number") {
    if (value < 20000 || value > 80000) return null;
    return parseDateCell(new Date(Math.round((value - 25569) * 86400 * 1000)), dayFirst);
  }

  const text = String(value).trim();
  // a CSV saved from Excel with a General-formatted date column holds the serial number as text
  if (/^\d{5}(\.\d+)?$/.test(text)) return parseDateCell(Number(text), dayFirst);
  let match = text.match(ISO_RE);
  if (match) return buildDate(+match[1], +match[2], +match[3], withMeridiem(+(match[4] ?? 0), match[7]), +(match[5] ?? 0), +(match[6] ?? 0));

  match = text.match(NUMERIC_RE);
  if (match) {
    const [first, second] = [+match[1], +match[2]];
    const [day, month] = dayFirst ? [first, second] : [second, first];
    return buildDate(+match[3], month, day, withMeridiem(+(match[4] ?? 0), match[7]), +(match[5] ?? 0), +(match[6] ?? 0));
  }

  match = text.match(DAY_MONTH_NAME_RE);
  if (match && MONTHS[match[2].slice(0, 3).toLowerCase()]) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    return buildDate(+match[3], month, +match[1], withMeridiem(+(match[4] ?? 0), match[7]), +(match[5] ?? 0), +(match[6] ?? 0));
  }

  match = text.match(MONTH_NAME_DAY_RE);
  if (match && MONTHS[match[1].slice(0, 3).toLowerCase()]) {
    return buildDate(+match[3], MONTHS[match[1].slice(0, 3).toLowerCase()], +match[2], withMeridiem(+(match[4] ?? 0), match[7]), +(match[5] ?? 0), +(match[6] ?? 0));
  }
  return null;
};

/** 1,23,456.50 / ₹ 1,200 / (45.5) / "12.5%" -> number, or null when it is not one. */
const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return null;
  let text = String(value).trim();
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/[,\s₹$€£]/g, "").replace(/^(INR|USD|EUR|GBP|Rs\.?)/i, "");
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(text)) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
};

const cleanSymbol = (value) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.replace(/^(NSE|BSE|NFO|BFO|MCX|CDS)[:\s]+/i, "").slice(0, 60);
};

const parseSide = (value) => {
  const text = String(value ?? "").trim().toLowerCase();
  if (/^(buy|b|bought|long|purchase)$/.test(text)) return "buy";
  if (/^(sell|s|sold|short|sale)$/.test(text)) return "sell";
  return null;
};

const parseDirection = (value) => {
  const text = String(value ?? "").trim().toLowerCase();
  if (/^(long|buy|b|bought)$/.test(text)) return "long";
  if (/^(short|sell|s|sold)$/.test(text)) return "short";
  return null;
};

/** Product / style text -> intraday | delivery | null (null = says nothing useful, e.g. NRML). */
export const kindFromText = (value) => {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return null;
  if (/^(intraday|intra day|intra-day|day|day trade|day trading|mis|i|bo|co|scalp|scalping)$/.test(text)) return "intraday";
  if (/^(delivery|cnc|d|btst|stbt|swing|positional|position|long term|longterm|long-term|carry|carry forward|overnight|mtf|investment)$/.test(text)) return "delivery";
  return null;
};

const round = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;

const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/* ---------------------------------------------------------------- pairing */

// Pairs buys and sells first-in-first-out per symbol. Same-symbol fills that open and close on the same days
// are merged into one trade at their volume-weighted prices, so a scaled-in position is one row, not five.
export const pairExecutions = (executions) => {
  const bySymbol = new Map();
  for (const execution of executions) {
    if (!bySymbol.has(execution.symbol)) bySymbol.set(execution.symbol, []);
    bySymbol.get(execution.symbol).push(execution);
  }

  const closed = new Map();
  const open = new Map();

  const addTo = (map, key, base, quantity, entryValue, exitValue, row, hint) => {
    const found = map.get(key) ?? { ...base, quantity: 0, entryValue: 0, exitValue: 0, rows: new Set(), hints: [] };
    found.quantity += quantity;
    found.entryValue += entryValue;
    found.exitValue += exitValue;
    found.rows.add(row);
    if (hint) found.hints.push(hint);
    map.set(key, found);
  };

  for (const [symbol, fills] of bySymbol) {
    const ordered = [...fills].sort((a, b) => a.key.localeCompare(b.key) || (a.ts ?? 0) - (b.ts ?? 0) || a.order - b.order);
    const lots = [];

    for (const fill of ordered) {
      let remaining = fill.quantity;

      while (remaining > 1e-9 && lots.length > 0 && lots[0].side !== fill.side) {
        const lot = lots[0];
        const matched = Math.min(lot.quantity, remaining);
        const direction = lot.side === "buy" ? "long" : "short";
        addTo(
          closed,
          `${symbol}|${direction}|${lot.key}|${fill.key}`,
          { symbol, direction, date: lot.key, exitDate: fill.key },
          matched,
          lot.price * matched,
          fill.price * matched,
          lot.row,
          lot.hint
        );
        closed.get(`${symbol}|${direction}|${lot.key}|${fill.key}`).rows.add(fill.row);
        lot.quantity -= matched;
        remaining -= matched;
        if (lot.quantity <= 1e-9) lots.shift();
      }

      if (remaining > 1e-9) lots.push({ side: fill.side, quantity: remaining, price: fill.price, key: fill.key, row: fill.row, hint: fill.hint });
    }

    for (const lot of lots) {
      const direction = lot.side === "buy" ? "long" : "short";
      addTo(open, `${symbol}|${direction}|${lot.key}`, { symbol, direction, date: lot.key, exitDate: null }, lot.quantity, lot.price * lot.quantity, 0, lot.row, lot.hint);
    }
  }

  const finish = (item, isOpen) => ({
    symbol: item.symbol,
    direction: item.direction,
    date: item.date,
    exitDate: item.exitDate,
    quantity: round(item.quantity, 6),
    entryPrice: round(item.entryValue / item.quantity),
    exitPrice: isOpen ? null : round(item.exitValue / item.quantity),
    rows: [...item.rows].sort((a, b) => a - b),
    hint: item.hints.find(Boolean) ?? null,
  });

  return [...closed.values()].map((item) => finish(item, false)).concat([...open.values()].map((item) => finish(item, true)));
};

/* -------------------------------------------------------------- tagging */

/** Intraday vs delivery, with the reason shown to the person so the tag is never a black box. */
export const classifyTrade = ({ date, exitDate, exitPrice, hint }, today = new Date().toISOString().slice(0, 10)) => {
  if (exitDate && exitPrice !== null) {
    if (exitDate === date) return { kind: "intraday", reason: "Opened and closed on the same day" };
    const days = daysBetween(date, exitDate);
    return { kind: "delivery", reason: `Held overnight (${days} ${days === 1 ? "day" : "days"})` };
  }
  if (hint) return { kind: hint.kind, reason: `Product column says ${hint.label}` };
  if (exitPrice === null && date < today) return { kind: "delivery", reason: "Still open after its entry day" };
  if (exitPrice === null) return { kind: "unknown", reason: "Open today: could become either" };
  return { kind: "unknown", reason: "No exit date or product column in the file" };
};

/* ---------------------------------------------------------------- preview */

const reasonText = {
  symbol: "Missing symbol",
  date: "Missing or unreadable date",
  side: "Buy/Sell or Long/Short not recognised",
  quantity: "Quantity is missing or not above zero",
  price: "Price is missing or not a number",
  exit: "Exit price is not a number",
  stop: "Stop loss is not a number",
};

const COLUMN_ROLES = ["date", "exitDate", "symbol", "side", "quantity", "price", "entry", "exit", "stop", "product", "notes", "time"];

/**
 * Offers likely header rows and automatic column guesses when a file uses unfamiliar headings.
 * Sample cells are included so the user can identify columns without relying on their names.
 */
export const inspectImportMapping = (rows) => {
  const rowCount = Math.min(rows.length, 25);
  const candidates = [];
  for (let index = 0; index < rowCount; index += 1) {
    const row = rows[index];
    const nonEmpty = row.filter((value) => value !== null && String(value).trim() !== "");
    if (nonEmpty.length < 2) continue;

    const body = rows.slice(index + 1, index + 4);
    const names = row.map((value, column) => String(value ?? "").trim() || `Column ${column + 1}`);
    const columns = mapColumns(row, body);
    const aliasCount = Object.keys(columns).length;
    const populated = body.reduce((score, sample) => score + sample.filter((value) => value !== null && String(value).trim() !== "").length, 0);
    const headerText = nonEmpty.filter((value) => typeof value === "string" && Number.isNaN(Number(value))).length;
    const score = aliasCount * 10 + headerText + Math.min(populated, row.length * 2);
    candidates.push({
      index,
      names,
      samples: body.map((sample) => row.map((_, column) => String(sample[column] ?? "").slice(0, 60))),
      mapping: Object.fromEntries(COLUMN_ROLES.filter((role) => columns[role] !== undefined).map((role) => [role, columns[role]])),
      score,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  const knownHeader = findHeader(rows);
  const suggested = candidates.find((candidate) => candidate.index === knownHeader) ?? candidates[0];
  const width = Math.max(1, ...rows.slice(0, MAX_FILE_ROWS + 1).map((row) => row.length));
  const headerless = {
    index: -1,
    names: Array.from({ length: width }, (_, column) => `Column ${column + 1}`),
    samples: rows.slice(0, 3).map((sample) => Array.from({ length: width }, (_, column) => String(sample[column] ?? "").slice(0, 60))),
    mapping: {},
  };
  return {
    headerIndex: suggested?.index ?? -1,
    detectedHeader: knownHeader >= 0,
    candidates: [headerless, ...candidates.map(({ score, ...candidate }) => candidate)],
  };
};

/**
 * Turns the file's rows into reviewable trades.
 * @returns {{ format: "trades"|"executions", trades: object[], skipped: object[], warnings: string[], totalRows: number, truncated: boolean }}
 */
export const buildPreview = (rows, { today, mapping = null } = {}) => {
  const headerless = mapping?.headerIndex === -1;
  const headerIndex = Number.isInteger(mapping?.headerIndex) ? mapping.headerIndex : findHeader(rows);
  if ((!headerless && (headerIndex < 0 || headerIndex >= rows.length)) || rows.length === 0) {
    throw new ApiError(400, "Could not find a header row. Choose manual column mapping to import a file with unfamiliar or missing headers.");
  }

  const width = Math.max(1, ...rows.map((row) => row.length));
  const header = headerless ? Array.from({ length: width }, (_, index) => `Column ${index + 1}`) : rows[headerIndex];
  const body = headerless ? rows : rows.slice(headerIndex + 1);
  const columns = mapColumns(header, body, mapping?.columns);
  const warnings = [];

  for (const [role, label] of [["symbol", "Symbol"], ["date", "Date"], ["quantity", "Quantity"]]) {
    if (columns[role] === undefined) throw new ApiError(400, `The file needs a "${label}" column.`);
  }

  const cell = (row, role) => (columns[role] === undefined ? null : row[columns[role]] ?? null);

  const dayFirst = detectDayFirst([...body.map((row) => cell(row, "date")), ...body.map((row) => cell(row, "exitDate"))]);

  // buy/sell fills have one price column and a Buy/Sell side; everything else is one row per trade
  const sideValues = columns.side === undefined ? [] : body.slice(0, 300).map((row) => cell(row, "side"));
  const sideIsBuySell = columns.side !== undefined && looksLike(sideValues, /^(buy|b|bought|sell|s|sold|sale|purchase)$/) >= 0.6;
  const format = columns.entry === undefined && columns.price !== undefined && sideIsBuySell ? "executions" : "trades";

  if (format === "trades" && columns.entry === undefined && columns.price === undefined) {
    throw new ApiError(400, 'The file needs a price column ("Entry Price" for one trade per row, or "Price" with a Buy/Sell column for broker tradebooks).');
  }
  if (format === "executions" && columns.side === undefined) {
    throw new ApiError(400, 'The file needs a "Buy/Sell" (or Long/Short) column.');
  }

  const skipped = [];
  const skip = (rowNumber, key, symbol = "") => skipped.push({ row: rowNumber, symbol, reason: reasonText[key] });

  const parsedRows = [];
  body.forEach((row, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const symbol = cleanSymbol(cell(row, "symbol"));
    const rawHint = cell(row, "product");
    const hintKind = kindFromText(rawHint);
    const hint = hintKind ? { kind: hintKind, label: String(rawHint).trim().toUpperCase() } : null;

    // fully blank-looking rows and totals lines are ignored without noise
    if (!symbol && row.every((value) => value === null || String(value).trim() === "")) return;
    if (!symbol) return skip(rowNumber, "symbol");

    const date = parseDateCell(cell(row, "date"), dayFirst);
    if (!date) return skip(rowNumber, "date", symbol);

    const quantity = parseNumber(cell(row, "quantity"));
    if (quantity === null || Math.abs(quantity) <= 0) return skip(rowNumber, "quantity", symbol);

    const notes = String(cell(row, "notes") ?? "").trim().slice(0, 2000);

    if (format === "executions") {
      const side = parseSide(cell(row, "side"));
      if (!side) return skip(rowNumber, "side", symbol);
      const price = parseNumber(cell(row, "price"));
      if (price === null || price < 0) return skip(rowNumber, "price", symbol);
      const clock = date.ts === null ? parseDateCell(cell(row, "time"), dayFirst) : null;
      parsedRows.push({ row: rowNumber, symbol, side, quantity: Math.abs(quantity), price, key: date.key, ts: date.ts ?? (clock?.key === date.key ? clock.ts : null), hint, notes });
      return;
    }

    // one row = one trade
    const entryRaw = cell(row, columns.entry !== undefined ? "entry" : "price");
    const entryPrice = parseNumber(entryRaw);
    if (entryPrice === null || entryPrice < 0) return skip(rowNumber, "price", symbol);

    let exitPrice = null;
    if (columns.exit !== undefined && cell(row, "exit") !== null && String(cell(row, "exit")).trim() !== "") {
      exitPrice = parseNumber(cell(row, "exit"));
      if (exitPrice === null || exitPrice < 0) return skip(rowNumber, "exit", symbol);
    }

    let stopLoss = null;
    if (columns.stop !== undefined && cell(row, "stop") !== null && String(cell(row, "stop")).trim() !== "") {
      stopLoss = parseNumber(cell(row, "stop"));
      if (stopLoss === null || stopLoss < 0) return skip(rowNumber, "stop", symbol);
    }

    let direction = columns.side === undefined ? "long" : parseDirection(cell(row, "side"));
    if (!direction && quantity < 0) direction = "short";
    if (!direction) return skip(rowNumber, "side", symbol);

    const exitDate = parseDateCell(cell(row, "exitDate"), dayFirst);
    parsedRows.push({
      row: rowNumber, symbol, direction, quantity: Math.abs(quantity), entryPrice, exitPrice, stopLoss, date: date.key,
      exitDate: exitPrice !== null && exitDate ? exitDate.key : null, hint, notes,
    });
  });

  let candidates;
  if (format === "executions") {
    // a file listed newest-first would otherwise pair a same-day sell before its buy
    const keys = parsedRows.map((item) => item.key);
    const descending = keys.length > 1 && keys[0] > keys[keys.length - 1];
    const fills = parsedRows.map((item, index) => ({ ...item, order: descending ? -index : index }));
    const notesByRow = new Map(parsedRows.filter((item) => item.notes).map((item) => [item.row, item.notes]));
    candidates = pairExecutions(fills).map((trade) => ({
      ...trade,
      stopLoss: null,
      notes: trade.rows.map((row) => notesByRow.get(row)).filter(Boolean)[0] ?? "",
    }));
    candidates.sort((a, b) => b.date.localeCompare(a.date) || a.symbol.localeCompare(b.symbol));
  } else {
    candidates = parsedRows.map((item) => ({ ...item, rows: [item.row] }));
    if (columns.side === undefined) {
      warnings.push('The file has no Direction column, so every trade is treated as Long. Add a "Direction" column if some were shorts.');
    }
  }

  const trades = candidates.map((trade, index) => {
    const { kind, reason } = classifyTrade(trade, today);
    const pnl = trade.exitPrice === null ? null : round((trade.exitPrice - trade.entryPrice) * (trade.direction === "short" ? -1 : 1) * trade.quantity, 2);
    return {
      id: `t${index}`,
      rows: trade.rows,
      date: trade.date,
      exitDate: trade.exitDate ?? null,
      symbol: trade.symbol,
      direction: trade.direction,
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      stopLoss: trade.stopLoss ?? null,
      pnl,
      kind,
      kindReason: reason,
      notes: trade.notes ?? "",
    };
  });

  if (trades.length === 0) {
    const first = skipped[0]?.reason;
    throw new ApiError(400, first ? `No trades could be read from this file. First problem: row ${skipped[0].row}: ${first}.` : "No trades were found in this file.");
  }

  return {
    format,
    trades,
    skipped: skipped.slice(0, 100),
    skippedCount: skipped.length,
    warnings,
    totalRows: body.length,
    truncated: false,
  };
};

/* ------------------------------------------------------------ commit side */

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const isRealKey = (value) => typeof value === "string" && DATE_KEY.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const optionalNumber = (value, label) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new ApiError(400, `${label} must be a valid non-negative number`);
  return parsed;
};

/**
 * Validates one reviewed trade from the client and returns the payload for the Trade model.
 * Nothing from the preview is trusted: the same rules as the trade form apply.
 * `attributes` are the journal's default properties, so a "Trade type" property the journal already has is reused.
 */
export const sanitizeImportTrade = (raw, position, attributes = []) => {
  const where = `Trade ${position + 1}`;
  const assetName = typeof raw?.symbol === "string" ? raw.symbol.trim().slice(0, 60) : "";
  if (!assetName) throw new ApiError(400, `${where}: asset name is required`);
  if (!isRealKey(raw?.date)) throw new ApiError(400, `${where}: a valid trade date is required`);

  const direction = String(raw?.direction ?? "").toLowerCase();
  if (!["long", "short"].includes(direction)) throw new ApiError(400, `${where}: direction must be long or short`);

  const quantity = Number(raw?.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new ApiError(400, `${where}: quantity must be greater than zero`);

  const entryPrice = Number(raw?.entryPrice);
  if (!Number.isFinite(entryPrice) || entryPrice < 0) throw new ApiError(400, `${where}: entry price must be a valid non-negative number`);

  const exitPrice = optionalNumber(raw?.exitPrice, `${where}: exit price`);
  const stopLoss = optionalNumber(raw?.stopLoss, `${where}: stop loss`);

  const keyFor = (field) => {
    const same = attributes.find((attribute) => attribute.type === field.type && String(attribute.label).trim().toLowerCase() === field.label.toLowerCase());
    return same?.key ?? field.key;
  };

  const customFields = [];
  if (raw?.kind === "intraday" || raw?.kind === "delivery") {
    customFields.push({ ...TRADE_TYPE_FIELD, key: keyFor(TRADE_TYPE_FIELD), value: TRADE_TYPE_LABELS[raw.kind] });
  }
  if (exitPrice !== null && isRealKey(raw?.exitDate) && raw.exitDate !== raw.date) {
    customFields.push({ ...EXIT_DATE_FIELD, key: keyFor(EXIT_DATE_FIELD), value: raw.exitDate });
  }

  const notes = typeof raw?.notes === "string" ? raw.notes.trim().slice(0, 2000) : "";

  return {
    date: new Date(raw.date),
    assetName,
    quantity,
    direction,
    entryPrice,
    exitPrice,
    stopLoss,
    analysis: notes ? `<p>${escapeHtml(notes).replace(/\r?\n/g, "<br>")}</p>` : "",
    images: [],
    customFields,
  };
};

/* --------------------------------------------------------------- template */

export const TEMPLATE_HEADER = ["Date", "Symbol", "Direction", "Quantity", "Entry Price", "Exit Price", "Stop Loss", "Exit Date", "Product", "Notes"];
export const TEMPLATE_ROWS = [
  ["2025-01-06", "RELIANCE", "Long", 50, 1215.5, 1238, 1204, "2025-01-06", "MIS", "Breakout above the opening range"],
  ["2025-01-08", "TCS", "Long", 20, 4120, 4310, 4040, "2025-01-14", "CNC", "Swing from weekly support"],
  ["2025-01-15", "NIFTY", "Short", 75, 23150, "", 23240, "", "", "Still open"],
];
