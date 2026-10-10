import { Journal, MAX_STRATEGY_HTML_LENGTH, MAX_STRATEGY_LENGTH } from "../models/journal.models.js";
import { Planner } from "../models/planner.models.js";
import { Trade } from "../models/trade.models.js";
import { AiReview } from "../models/aiReview.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteImagesFromCloudinary } from "../utils/cloudinary.js";
import { DEFAULT_CURRENCY, isValidCurrency, normalizeCurrency } from "../constants/currency.js";
import { applyContextToFields, parseCustomFields } from "../utils/customFields.js";
import { htmlToPlainText, sanitizeRichText } from "../utils/richText.js";

const imageUrlsFromHtml = (html = "") =>
  [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1].trim()).filter(Boolean);

const serializeTrade = (trade) => {
  const direction = trade.direction === "long" ? "Long" : "Short";
  const quantity = Number(trade.quantity ?? 0);

  return {
    id: String(trade._id),
    symbol: trade.assetName,
    assetName: trade.assetName,
    date: trade.date ? new Date(trade.date).toISOString().slice(0, 10) : "",
    quantity,
    qty: quantity,
    direction,
    side: direction,
    entry: trade.entryPrice,
    entryPrice: trade.entryPrice,
    exit: trade.exitPrice ?? "",
    exitPrice: trade.exitPrice ?? "",
    stopLoss: trade.stopLoss ?? "",
    analysis: trade.analysis ?? "",
    images: Array.isArray(trade.images) ? trade.images : [],
    customFields: Array.isArray(trade.customFields)
      ? trade.customFields.map(({ key, label, type, value }) => ({ key, label, type, value }))
      : [],
    status: trade.exitPrice == null ? "Open" : "Closed",
    pnl: trade.exitPrice == null ? "$0" : `$${((trade.exitPrice - trade.entryPrice) * (trade.direction === "short" ? -1 : 1) * quantity).toFixed(2)}`,
    createdAt: trade.createdAt ? new Date(trade.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: trade.updatedAt ? new Date(trade.updatedAt).toISOString() : new Date().toISOString(),
  };
};

const serializeContext = (context) => ({
  strategy: context?.strategy ?? "",
  attributes: Array.isArray(context?.attributes)
    ? context.attributes.map(({ key, label, type, value }) => ({ key, label, type, value }))
    : [],
});

// validates the journal context sent from the header editor
const parseJournalContext = (raw) => {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ApiError(400, "Journal context must be an object");
  }

  const rawStrategy = raw.strategy ?? "";
  if (typeof rawStrategy !== "string") throw new ApiError(400, "Strategy must be text");
  if (rawStrategy.length > MAX_STRATEGY_HTML_LENGTH * 2) throw new ApiError(400, "Strategy is too long");

  // the editor sends HTML: keep only formatting tags, and measure the length of the visible text
  const strategy = sanitizeRichText(rawStrategy);
  if (htmlToPlainText(strategy).length > MAX_STRATEGY_LENGTH) {
    throw new ApiError(400, `Strategy can be up to ${MAX_STRATEGY_LENGTH} characters`);
  }
  if (strategy.length > MAX_STRATEGY_HTML_LENGTH) {
    throw new ApiError(400, "Strategy has too much formatting. Remove some and try again.");
  }

  const attributes = parseCustomFields(raw.attributes);
  if (new Set(attributes.map((attribute) => attribute.key)).size !== attributes.length) {
    throw new ApiError(400, "Each default property needs its own key");
  }

  return { strategy, attributes };
};

const serializeJournal = (journal) => ({
  id: String(journal._id),
  _id: journal._id,
  name: journal.journalName,
  journalName: journal.journalName,
  description: journal.description ?? "",
  currency: journal.currency ?? DEFAULT_CURRENCY,
  context: serializeContext(journal.context),
  createdAt: journal.createdAt ? new Date(journal.createdAt).toISOString() : new Date().toISOString(),
  updatedAt: journal.updatedAt ? new Date(journal.updatedAt).toISOString() : new Date().toISOString(),
  updated: "Just now",
  trades: (journal.trades ?? []).map(serializeTrade),
});

export const getAllJournals = asyncHandler(async (req, res) => {
  const journals = await Journal.find({ owner: req.user._id })
    .sort({ updatedAt: -1 })
    .populate({
      path: "trades",
      options: { sort: { date: -1, createdAt: -1 } },
    });

  return res
    .status(200)
    .json(new ApiResponse(200, journals.map(serializeJournal), "Journals fetched successfully"));
});

export const createJournal = asyncHandler(async (req, res) => {
  const { journalName, name, description, currency } = req.body ?? {};
  const trimmedName = (journalName ?? name)?.trim();
  const normalizedCurrency = currency === undefined || currency === null || currency === "" ? DEFAULT_CURRENCY : normalizeCurrency(currency);

  if (!trimmedName) {
    throw new ApiError(400, "Journal name is required");
  }
  if (!isValidCurrency(normalizedCurrency)) {
    throw new ApiError(400, "Unsupported currency code");
  }
  if (description !== undefined && typeof description !== "string") {
    throw new ApiError(400, "Journal description must be a string");
  }

  const journal = await Journal.create({
    journalName: trimmedName,
    description: description?.trim(),
    currency: normalizedCurrency,
    owner: req.user._id,
  });

  const populatedJournal = await Journal.findById(journal._id).populate({
    path: "trades",
    options: { sort: { date: -1, createdAt: -1 } },
  });

  return res
    .status(201)
    .json(new ApiResponse(201, serializeJournal(populatedJournal), "Journal created successfully"));
});

export const updateJournal = asyncHandler(async (req, res) => {
  const { journalId } = req.params;
  const { journalName, name, context, applyToExistingTrades } = req.body ?? {};
  // true (default) = also update trades logged before; false = only trades created from now on
  if (applyToExistingTrades !== undefined && typeof applyToExistingTrades !== "boolean") {
    throw new ApiError(400, "applyToExistingTrades must be true or false");
  }
  const applyToExisting = applyToExistingTrades !== false;
  const rawName = journalName ?? name;
  const update = {};

  if (rawName !== undefined) {
    const trimmedName = typeof rawName === "string" ? rawName.trim() : "";
    if (!trimmedName) {
      throw new ApiError(400, "Journal name is required");
    }
    update.journalName = trimmedName;
  }

  if (context !== undefined) {
    const parsed = parseJournalContext(context);
    update["context.strategy"] = parsed.strategy;
    update["context.attributes"] = parsed.attributes;
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "Nothing to update");
  }

  const journal = await Journal.findOneAndUpdate(
    { _id: journalId, owner: req.user._id },
    update,
    { new: true }
  );

  if (!journal) {
    throw new ApiError(404, "Journal not found");
  }

  // unless the user chose "new trades only", the context also applies to trades logged before it was written
  if (context !== undefined && applyToExisting) {
    const trades = await Trade.find({ journal: journal._id, owner: req.user._id }).select("customFields");
    const operations = [];
    for (const trade of trades) {
      const { fields, changed } = applyContextToFields(trade.customFields, journal.context.attributes);
      if (changed) {
        operations.push({ updateOne: { filter: { _id: trade._id }, update: { $set: { customFields: fields } } } });
      }
    }
    if (operations.length) await Trade.bulkWrite(operations);
  }

  await journal.populate({
    path: "trades",
    options: { sort: { date: -1, createdAt: -1 } },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, serializeJournal(journal), "Journal updated successfully"));
});

export const deleteJournal = asyncHandler(async (req, res) => {
  const { journalId } = req.params;

  const journal = await Journal.findOne({ _id: journalId, owner: req.user._id });
  if (!journal) {
    throw new ApiError(404, "Journal not found");
  }

  const trades = await Trade.find({ journal: journal._id, owner: req.user._id });
  await Trade.deleteMany({ journal: journal._id, owner: req.user._id });
  await AiReview.deleteMany({ journal: journal._id, owner: req.user._id });
  // planners connected to this journal stay, they just are not connected to anything anymore
  await Planner.updateMany({ linkedJournal: journal._id, owner: req.user._id }, { $set: { linkedJournal: null } });
  await Journal.deleteOne({ _id: journal._id, owner: req.user._id });

  void deleteImagesFromCloudinary(
    trades.flatMap((trade) => [
      ...(Array.isArray(trade.images) ? trade.images : []),
      ...imageUrlsFromHtml(trade.analysis),
    ]),
    `trading-journal/${journal._id}`
  );

  return res.status(200).json(new ApiResponse(200, { journalId }, "Journal deleted successfully"));
});