import crypto from "node:crypto";
import { ApiError } from "./ApiError.js";
import { getEntitlements } from "./entitlements.js";

export const SUPPORTED_BROKER_IDS = [
  "zerodha",
  "dhan",
  "upstox",
  "angelone",
  "fyers",
  "tradingview",
  "mt5",
  "ctrader",
  "binance",
  "ibkr",
  "custom",
];

const MAX_PROCESSED_ORDER_IDS = 500;

// Per-journal in-process lock so simultaneous webhooks (e.g. duplicate retries or rapid entry+exit fills
// arriving milliseconds apart) execute strictly sequentially for a given journal.
const journalLocks = new Map();

export const withJournalLock = async (journalId, task) => {
  const key = String(journalId);
  const previous = journalLocks.get(key) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  const chain = previous.then(() => current, () => current);
  journalLocks.set(key, chain);

  try {
    await previous.catch(() => {});
    return await task();
  } finally {
    release();
    if (journalLocks.get(key) === chain) {
      journalLocks.delete(key);
    }
  }
};

export const generateWebhookToken = () => `tcwh_${crypto.randomBytes(24).toString("hex")}`;

export const assertAutoLogEntitled = (user, now = Date.now()) => {
  const entitlements = getEntitlements(user, now);
  if (entitlements.autoLogWebhook !== true) {
    throw new ApiError(
      403,
      "Auto-logging trades via broker webhook requires a Pro subscription.",
      [],
      "",
      { code: "PLAN_LIMIT", feature: "autoLogWebhook" }
    );
  }
};

const cleanNumericInput = (value) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  // Strip currency symbols ($, ₹, €, £), commas, and spaces: e.g. "₹51,200.50" -> "51200.50"
  const cleaned = value.replace(/[$₹€£,\s]/g, "").trim();
  return cleaned === "" ? NaN : Number(cleaned);
};

const toPositiveNumber = (value) => {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const num = cleanNumericInput(value);
  return Number.isFinite(num) && num > 0 && num <= Number.MAX_SAFE_INTEGER ? num : null;
};

const toNonNegativeNumber = (value) => {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const num = cleanNumericInput(value);
  return Number.isFinite(num) && num >= 0 && num <= Number.MAX_SAFE_INTEGER ? num : null;
};

const parseTimestampInfo = (value) => {
  if (!value) return { date: new Date(), hasExplicitTime: false, rawTimeKey: "" };
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { date: value, hasExplicitTime: true, rawTimeKey: value.toISOString() };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      return { date: d, hasExplicitTime: true, rawTimeKey: String(Math.trunc(ms)) };
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && /^\d{10,13}$/.test(trimmed)) {
      const ms = numeric < 1e12 ? numeric * 1000 : numeric;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) {
        return { date: d, hasExplicitTime: true, rawTimeKey: String(Math.trunc(ms)) };
      }
    }
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) {
      return { date: d, hasExplicitTime: true, rawTimeKey: trimmed };
    }
  }
  return { date: new Date(), hasExplicitTime: false, rawTimeKey: "" };
};

const parseSideOrDirection = (raw) => {
  if (raw === 1 || raw === "1") return { side: "BUY", direction: "long" };
  if (raw === -1 || raw === "-1" || raw === 2 || raw === "2") return { side: "SELL", direction: "short" };
  if (typeof raw !== "string") return null;
  const norm = raw.trim().toUpperCase();
  if (
    [
      "BUY",
      "B",
      "LONG",
      "BOT",
      "DEAL_TYPE_BUY",
      "ORDER_TYPE_BUY",
      "ENTRY_LONG",
      "COVER",
      "BUY_TO_OPEN",
      "BUY_TO_CLOSE",
    ].includes(norm)
  ) {
    return { side: "BUY", direction: "long" };
  }
  if (
    [
      "SELL",
      "S",
      "SHORT",
      "SLD",
      "DEAL_TYPE_SELL",
      "ORDER_TYPE_SELL",
      "ENTRY_SHORT",
      "SELL_SHORT",
      "SELL_TO_OPEN",
      "SELL_TO_CLOSE",
    ].includes(norm)
  ) {
    return { side: "SELL", direction: "short" };
  }
  return null;
};

/**
 * Only final executed/filled statuses are logged. Intermediate statuses like PARTIALLY_FILLED,
 * OPEN, PENDING, UPDATE, MODIFIED, CANCELLED, or REJECTED are ignored so order postbacks
 * (which emit intermediate updates before the final COMPLETE/TRADED event) never double-count.
 */
const isExecutedStatus = (rawStatus) => {
  if (rawStatus === undefined || rawStatus === null || rawStatus === "") return true;
  if (typeof rawStatus === "number") {
    // Fyers status 2 = Traded / Filled; HTTP 200 wrapper
    return rawStatus === 2 || rawStatus === 200;
  }
  const status = String(rawStatus).trim().toUpperCase();
  const allowed = new Set([
    "COMPLETE",
    "COMPLETED",
    "TRADED",
    "FILLED",
    "CLOSED",
    "EXECUTED",
    "TRADE",
    "DEAL_ENTRY_IN",
    "DEAL_ENTRY_OUT",
    "OK",
    "SUCCESS",
  ]);
  return allowed.has(status);
};

const detectSource = (row, brokerHint = "custom") => {
  if (!row || typeof row !== "object") return brokerHint;
  if ("dhanClientId" in row || ("orderStatus" in row && "tradingSymbol" in row)) return "dhan";
  if ("tradingsymbol" in row && "transaction_type" in row && ("order_id" in row || "kite" in row)) return "zerodha";
  if ("trading_symbol" in row && "transaction_type" in row) return "upstox";
  if ("tradingsymbol" in row && "transactiontype" in row) return "angelone";
  if ("filledQty" in row && "tradedPrice" in row && ("fyToken" in row || "side" in row)) return "fyers";
  if ("ticket" in row && ("openPrice" in row || "closePrice" in row || "lots" in row)) return "mt5";
  if ("s" in row && "S" in row && ("L" in row || "ap" in row || "q" in row)) return "binance";
  if ("ticker" in row || "strategy" in row) return "tradingview";
  return SUPPORTED_BROKER_IDS.includes(brokerHint) ? brokerHint : "custom";
};

/**
 * Normalizes instrument symbol for matching open vs closing fills.
 * Strips exchange prefixes like "NSE:", "NFO:", "BSE:", "MCX:", "BINANCE:" and "-EQ" suffix so
 * "NSE:SBIN-EQ" and "SBIN" match the same position cleanly.
 */
export const canonicalSymbolKey = (symbol = "") =>
  String(symbol)
    .trim()
    .toUpperCase()
    .replace(/^[A-Z0-9_]+:/, "")
    .replace(/-EQ$/, "");

const buildDeterministicFingerprint = ({
  source,
  assetName,
  kind,
  side,
  direction,
  quantity,
  price,
  entryPrice,
  exitPrice,
  rawTimeKey,
}) => {
  if (!rawTimeKey) return null;
  const raw = [
    source,
    canonicalSymbolKey(assetName),
    kind,
    side ?? direction,
    quantity,
    price ?? "",
    entryPrice ?? "",
    exitPrice ?? "",
    rawTimeKey,
  ].join("|");
  const digest = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 24);
  return `${source}:fp_${digest}`;
};

const normalizeSingleRecord = (raw, brokerHint = "custom") => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw.order && typeof raw.order === "object" ? raw.order : raw;

  const rawStatus =
    row.status ??
    row.orderStatus ??
    row.order_status ??
    row.orderstatus ??
    row.X ??
    row.execType;
  if (!isExecutedStatus(rawStatus)) return null;

  const source = detectSource(row, brokerHint);

  const rawSymbol =
    row.assetName ??
    row.symbol ??
    row.ticker ??
    row.instrument ??
    row.tradingsymbol ??
    row.tradingSymbol ??
    row.trading_symbol ??
    row.instrument_token ??
    row.s ??
    "";
  const assetName = String(rawSymbol).trim();
  if (!assetName || assetName.length > 128) return null;

  const rawSideField =
    row.direction ??
    row.side ??
    row.action ??
    row.transaction_type ??
    row.transactionType ??
    row.transactiontype ??
    row.dealType ??
    row.type ??
    row.S ??
    row?.strategy?.order?.action;

  const sideInfo = parseSideOrDirection(rawSideField);
  if (!sideInfo) return null;

  const quantity = toPositiveNumber(
    row.quantity ??
      row.qty ??
      row.filled_quantity ??
      row.tradedQuantity ??
      row.filledshares ??
      row.filledQty ??
      row.contracts ??
      row.volume ??
      row.lots ??
      row.cumExecQty ??
      row.l ??
      row.q ??
      row?.strategy?.order?.contracts
  );
  if (!quantity) return null;

  const explicitEntry = toNonNegativeNumber(row.entryPrice ?? row.entry ?? row.openPrice ?? row.open_price);
  const explicitExit = toNonNegativeNumber(row.exitPrice ?? row.exit ?? row.closePrice ?? row.close_price);
  const singleFillPrice = toNonNegativeNumber(
    row.price ??
      row.average_price ??
      row.tradedPrice ??
      row.averageprice ??
      row.fillprice ??
      row.avgPrice ??
      row.execPrice ??
      row.L ??
      row.ap ??
      row?.strategy?.order?.price
  );

  const stopLoss = toPositiveNumber(row.stopLoss ?? row.stop_loss ?? row.sl ?? row.trigger_price ?? row.triggerPrice);
  const { date, hasExplicitTime, rawTimeKey } = parseTimestampInfo(
    row.tradedAt ??
      row.order_timestamp ??
      row.exchange_timestamp ??
      row.exchangeTime ??
      row.fill_timestamp ??
      row.closeTime ??
      row.openTime ??
      row.timestamp ??
      row.time ??
      row.T ??
      row.date
  );

  // Prefer execution/trade ID (`trade_id`, `exchangeTradeId`, `execId`, `fillId`) over `order_id` when both exist,
  // so distinct partial fills in a tradebook each have their own ID while order postbacks deduplicate by `order_id`.
  const rawExternalIdValue =
    row.externalId ??
    row.tradeId ??
    row.trade_id ??
    row.exchangeTradeId ??
    row.exchange_trade_id ??
    row.execId ??
    row.fillId ??
    row.fill_id ??
    row.ticket ??
    row.order_id ??
    row.orderId ??
    row.orderid ??
    row.id ??
    row.t ??
    null;
  const rawExternalId =
    (typeof rawExternalIdValue === "string" &&
      rawExternalIdValue.trim().length > 0 &&
      rawExternalIdValue.length <= 200) ||
    (typeof rawExternalIdValue === "number" && Number.isSafeInteger(rawExternalIdValue))
      ? rawExternalIdValue
      : null;

  const eventHint = String(row.event ?? row.eventType ?? row.positionAction ?? "").trim().toLowerCase();

  // Case 1: Round-trip trade payload (has both entryPrice and exitPrice)
  if (explicitEntry !== null && explicitExit !== null) {
    const externalId =
      rawExternalId !== null && rawExternalId !== undefined && String(rawExternalId).trim() !== ""
        ? `${source}:${String(rawExternalId).trim()}`
        : buildDeterministicFingerprint({
            source,
            assetName,
            kind: "roundtrip",
            direction: sideInfo.direction,
            quantity,
            entryPrice: explicitEntry,
            exitPrice: explicitExit,
            rawTimeKey,
          });

    return {
      kind: "roundtrip",
      source,
      externalId,
      assetName,
      direction: sideInfo.direction,
      quantity,
      entryPrice: explicitEntry,
      exitPrice: explicitExit,
      stopLoss,
      date,
      hasExplicitTime,
    };
  }

  // Case 2: Single execution fill (entry, scale-in, partial exit, or full exit)
  const fillPrice = singleFillPrice ?? explicitEntry ?? explicitExit;
  if (fillPrice === null) return null;

  const externalId =
    rawExternalId !== null && rawExternalId !== undefined && String(rawExternalId).trim() !== ""
      ? `${source}:${String(rawExternalId).trim()}`
      : buildDeterministicFingerprint({
          source,
          assetName,
          kind: "fill",
          side: sideInfo.side,
          quantity,
          price: fillPrice,
          rawTimeKey,
        });

  return {
    kind: "fill",
    source,
    externalId,
    eventHint,
    assetName,
    side: sideInfo.side,
    direction: sideInfo.direction,
    quantity,
    price: fillPrice,
    stopLoss,
    date,
    hasExplicitTime,
  };
};

/**
 * Accepts a webhook body or broker feed response (single object, array, or `{ data / trades / orders / tradeBook }` wrapper)
 * and returns normalized trade/fill items sorted chronologically (oldest first) so entry fills always precede exit fills.
 */
export const normalizeBrokerPayload = (payload, brokerHint = "custom") => {
  if (!payload || typeof payload !== "object") return [];

  let list;
  if (Array.isArray(payload)) {
    list = payload;
  } else if (Array.isArray(payload.trades)) {
    list = payload.trades;
  } else if (Array.isArray(payload.orders)) {
    list = payload.orders;
  } else if (Array.isArray(payload.tradeBook)) {
    list = payload.tradeBook;
  } else if (Array.isArray(payload.orderBook)) {
    list = payload.orderBook;
  } else if (Array.isArray(payload.data)) {
    list = payload.data;
  } else if (payload.data && typeof payload.data === "object") {
    if (Array.isArray(payload.data.trades)) list = payload.data.trades;
    else if (Array.isArray(payload.data.orders)) list = payload.data.orders;
    else list = [payload.data];
  } else {
    list = [payload];
  }

  const normalized = list
    .map((item, index) => {
      const parsed = normalizeSingleRecord(item, brokerHint);
      return parsed ? { ...parsed, _originalIndex: index } : null;
    })
    .filter(Boolean);

  // When a batch feed has explicit timestamps, sort oldest-first so BUY @ 09:30 matches before SELL @ 14:30
  if (normalized.length > 1 && normalized.every((item) => item.hasExplicitTime)) {
    normalized.sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime();
      return diff !== 0 ? diff : a._originalIndex - b._originalIndex;
    });
  }

  return normalized.map(({ _originalIndex, hasExplicitTime, ...clean }) => clean); // eslint-disable-line no-unused-vars
};

const roundPrice = (value) => Math.round(value * 1e6) / 1e6;

const buildDefaultCustomFields = (journal, source) => {
  const base = [
    { key: "auto_log_source", label: "Auto-logged via", type: "text", value: source.toUpperCase() },
  ];
  const journalAttributes = journal?.context?.attributes;
  if (Array.isArray(journalAttributes) && journalAttributes.length > 0) {
    const seen = new Set(base.map((item) => item.key));
    for (const attr of journalAttributes) {
      if (attr?.key && !seen.has(attr.key)) {
        seen.add(attr.key);
        base.push({
          key: attr.key,
          label: attr.label ?? attr.key,
          type: attr.type ?? "text",
          value: attr.value ?? "",
        });
      }
    }
  }
  return base;
};

/**
 * Matches normalized fills/trades against open trades in the journal and persists them via `TradeModel`.
 * Enforces `entitlements.autoLogWebhook` on the journal owner and deduplicates `externalId`.
 */
export const applyNormalizedAutoLogItems = async ({
  journal,
  ownerUser,
  items,
  TradeModel,
  now = Date.now(),
}) => {
  assertAutoLogEntitled(ownerUser, now);

  const processedList = Array.isArray(journal.autoLog?.processedOrderIds)
    ? [...journal.autoLog.processedOrderIds]
    : [];
  const processedSet = new Set(processedList);

  const createdOrUpdated = [];
  const newTrades = [];
  let skippedDuplicates = 0;

  for (const item of items) {
    if (item.externalId && processedSet.has(item.externalId)) {
      skippedDuplicates += 1;
      continue;
    }

    const defaultFields = buildDefaultCustomFields(journal, item.source);

    if (item.kind === "roundtrip") {
      const created = await TradeModel.create({
        date: item.date,
        assetName: item.assetName,
        quantity: item.quantity,
        direction: item.direction,
        entryPrice: item.entryPrice,
        exitPrice: item.exitPrice,
        stopLoss: item.stopLoss ?? null,
        analysis: "",
        images: [],
        customFields: defaultFields,
        owner: journal.owner,
        journal: journal._id,
      });
      createdOrUpdated.push(created);
      newTrades.push(created);
    } else if (item.kind === "fill") {
      // Match open trades by canonical symbol (so "NSE:SBIN-EQ" and "SBIN" match cleanly)
      const targetCanonical = canonicalSymbolKey(item.assetName);
      const escapedCanonical = targetCanonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const openTrade =
        item.eventHint === "open"
          ? null
          : await TradeModel.findOne({
              journal: journal._id,
              owner: journal.owner,
              exitPrice: null,
              assetName: { $regex: new RegExp(`^(?:[A-Z0-9_]+:)?${escapedCanonical}(?:-EQ)?$`, "i") },
            }).sort({ date: -1, createdAt: -1 });

      const incomingDirection = item.side === "BUY" ? "long" : "short";

      if (!openTrade) {
        if (item.eventHint === "close") {
          if (item.externalId) {
            processedSet.add(item.externalId);
            processedList.push(item.externalId);
          }
          continue;
        }
        const created = await TradeModel.create({
          date: item.date,
          assetName: item.assetName,
          quantity: item.quantity,
          direction: incomingDirection,
          entryPrice: item.price,
          exitPrice: null,
          stopLoss: item.stopLoss ?? null,
          analysis: "",
          images: [],
          customFields: defaultFields,
          owner: journal.owner,
          journal: journal._id,
        });
        createdOrUpdated.push(created);
        newTrades.push(created);
      } else if (openTrade.direction === incomingDirection && item.eventHint !== "close") {
        // Scaling into the same open position -> weighted average entry price
        const totalQty = roundPrice(openTrade.quantity + item.quantity);
        const avgEntry = roundPrice(
          (openTrade.entryPrice * openTrade.quantity + item.price * item.quantity) / totalQty
        );
        openTrade.entryPrice = avgEntry;
        openTrade.quantity = totalQty;
        if (item.stopLoss) openTrade.stopLoss = item.stopLoss;
        await openTrade.save();
        createdOrUpdated.push(openTrade);
      } else {
        // Opposite fill (or explicit close) -> closes all or part of `openTrade`
        if (item.quantity >= openTrade.quantity) {
          const remainder = roundPrice(item.quantity - openTrade.quantity);
          openTrade.exitPrice = item.price;
          await openTrade.save();
          createdOrUpdated.push(openTrade);

          if (remainder > 0 && item.eventHint !== "close") {
            const reversed = await TradeModel.create({
              date: item.date,
              assetName: item.assetName,
              quantity: remainder,
              direction: incomingDirection,
              entryPrice: item.price,
              exitPrice: null,
              stopLoss: item.stopLoss ?? null,
              analysis: "",
              images: [],
              customFields: defaultFields,
              owner: journal.owner,
              journal: journal._id,
            });
            createdOrUpdated.push(reversed);
            newTrades.push(reversed);
          }
        } else {
          // Partial exit: reduce open trade quantity and log a closed trade for the exited portion
          openTrade.quantity = roundPrice(openTrade.quantity - item.quantity);
          await openTrade.save();

          const partialClosed = await TradeModel.create({
            date: item.date,
            assetName: openTrade.assetName,
            quantity: item.quantity,
            direction: openTrade.direction,
            entryPrice: openTrade.entryPrice,
            exitPrice: item.price,
            stopLoss: openTrade.stopLoss ?? null,
            analysis: "",
            images: [],
            customFields:
              Array.isArray(openTrade.customFields) && openTrade.customFields.length > 0
                ? openTrade.customFields
                : defaultFields,
            owner: journal.owner,
            journal: journal._id,
          });
          createdOrUpdated.push(partialClosed);
          newTrades.push(partialClosed);
        }
      }
    }

    if (item.externalId) {
      processedSet.add(item.externalId);
      processedList.push(item.externalId);
    }
  }

  const trimmedProcessed = processedList.slice(-MAX_PROCESSED_ORDER_IDS);

  return {
    trades: createdOrUpdated,
    newTrades,
    loggedCount: createdOrUpdated.length,
    skippedDuplicates,
    processedOrderIds: trimmedProcessed,
  };
};
