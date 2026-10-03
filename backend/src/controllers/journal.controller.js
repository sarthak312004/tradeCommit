import { Journal } from "../models/journal.models.js";
import { Trade } from "../models/trade.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteImagesFromCloudinary } from "../utils/cloudinary.js";
import { DEFAULT_CURRENCY, isValidCurrency, normalizeCurrency } from "../constants/currency.js";

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

const serializeJournal = (journal) => ({
  id: String(journal._id),
  _id: journal._id,
  name: journal.journalName,
  journalName: journal.journalName,
  description: journal.description ?? "",
  currency: journal.currency ?? DEFAULT_CURRENCY,
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
      options: { sort: { date: -1 } },
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
    options: { sort: { date: -1 } },
  });

  return res
    .status(201)
    .json(new ApiResponse(201, serializeJournal(populatedJournal), "Journal created successfully"));
});

export const updateJournal = asyncHandler(async (req, res) => {
  const { journalId } = req.params;
  const { journalName, name } = req.body ?? {};
  const trimmedName = (journalName ?? name)?.trim();

  if (!trimmedName) {
    throw new ApiError(400, "Journal name is required");
  }

  const journal = await Journal.findOneAndUpdate(
    { _id: journalId, owner: req.user._id },
    { journalName: trimmedName },
    { new: true }
  ).populate({
    path: "trades",
    options: { sort: { date: -1 } },
  });

  if (!journal) {
    throw new ApiError(404, "Journal not found");
  }

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
  await Journal.deleteOne({ _id: journal._id, owner: req.user._id });

  await deleteImagesFromCloudinary(
    trades.flatMap((trade) => [
      ...(Array.isArray(trade.images) ? trade.images : []),
      ...imageUrlsFromHtml(trade.analysis),
    ]),
    `trading-journal/${journal._id}`
  );

  return res.status(200).json(new ApiResponse(200, { journalId }, "Journal deleted successfully"));
});