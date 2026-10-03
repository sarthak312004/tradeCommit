import mongoose from "mongoose";
import { Journal } from "../models/journal.models.js";
import { Trade } from "../models/trade.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

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
    status: trade.exitPrice == null ? "Open" : "Closed",
    pnl: trade.exitPrice == null ? "$0" : `$${((trade.exitPrice - trade.entryPrice) * (trade.direction === "short" ? -1 : 1) * quantity).toFixed(2)}`,
    createdAt: trade.createdAt ? new Date(trade.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: trade.updatedAt ? new Date(trade.updatedAt).toISOString() : new Date().toISOString(),
  };
};

const parseTradePayload = (body) => {
  const fullBody = body ?? {};
  const rawDirection = fullBody.direction ?? fullBody.side ?? "Long";
  const direction = String(rawDirection).toLowerCase();
  const assetName = typeof fullBody.assetName === "string" ? fullBody.assetName : typeof fullBody.symbol === "string" ? fullBody.symbol : "";
  const date = fullBody.date ?? new Date().toISOString().slice(0, 10);
  const quantity = Number(fullBody.quantity ?? fullBody.qty ?? 0);
  const entryPrice = Number(fullBody.entry ?? fullBody.entryPrice ?? 0);
  const exitPrice = fullBody.exit ?? fullBody.exitPrice ?? "";
  const stopLoss = fullBody.stopLoss ?? "";
  const analysis = typeof fullBody.analysis === "string" ? fullBody.analysis : "";
  const imagesFromBody = Array.isArray(fullBody.images) ? fullBody.images : [];
  const extractedImages = Array.from(new Set((analysis.match(/<img[^>]+src=["'][^"']+["']/gi) ?? [])
    .map((tag) => tag.match(/src=["']([^"']+)["']/i)?.[1])
    .filter(Boolean)
    .concat(imagesFromBody.filter((image) => typeof image === "string" && image.trim()))
    .map((image) => image.trim())
    .filter(Boolean)));

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ApiError(400, "Quantity must be greater than zero");
  }
  if (!Number.isFinite(entryPrice) || entryPrice < 0) {
    throw new ApiError(400, "Entry price must be a valid non-negative number");
  }
  if (!date || Number.isNaN(Date.parse(date))) {
    throw new ApiError(400, "A valid trade date is required");
  }
  if (!assetName.trim()) {
    throw new ApiError(400, "Asset name is required");
  }
  if (!["long", "short"].includes(direction)) {
    throw new ApiError(400, "Direction must be long or short");
  }

  // null (not undefined) so that clearing the exit on edit re-opens the trade instead of keeping the old exit
  let parsedExitPrice = null;
  if (exitPrice !== undefined && exitPrice !== null && exitPrice !== "") {
    parsedExitPrice = Number(exitPrice);
    if (!Number.isFinite(parsedExitPrice) || parsedExitPrice < 0) {
      throw new ApiError(400, "Exit price must be a valid non-negative number");
    }
  }

  // null (not undefined) so that clearing the field on edit actually removes the stored stop
  let parsedStopLoss = null;
  if (stopLoss !== undefined && stopLoss !== null && stopLoss !== "") {
    parsedStopLoss = Number(stopLoss);
    if (!Number.isFinite(parsedStopLoss) || parsedStopLoss < 0) {
      throw new ApiError(400, "Stop loss must be a valid non-negative number");
    }
  }

  return {
    date: new Date(date),
    assetName: assetName.trim(),
    quantity,
    direction,
    entryPrice,
    exitPrice: parsedExitPrice,
    stopLoss: parsedStopLoss,
    analysis: analysis.trim(),
    images: extractedImages,
  };
};

export const getTradesByJournal = asyncHandler(async (req, res) => {
  const { journalId } = req.params;

  if (!mongoose.isValidObjectId(journalId)) {
    throw new ApiError(400, "A valid journal ID is required");
  }

  const journal = await Journal.findOne({ _id: journalId, owner: req.user._id });
  if (!journal) {
    throw new ApiError(404, "Journal not found");
  }

  const trades = await Trade.find({ journal: journal._id, owner: req.user._id }).sort({ date: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, trades.map(serializeTrade), "Trades fetched successfully"));
});

export const uploadTradeImage = asyncHandler(async (req, res) => {
  const { journalId } = req.params;

  if (!mongoose.isValidObjectId(journalId)) {
    throw new ApiError(400, "A valid journal ID is required");
  }
  if (!req.file) {
    throw new ApiError(400, "An image file is required");
  }

  const journal = await Journal.findOne({ _id: journalId, owner: req.user._id });
  if (!journal) {
    throw new ApiError(404, "Journal not found");
  }

  const uploadedImage = await uploadOnCloudinary(req.file.buffer, `trading-journal/${journalId}`);

  return res
    .status(201)
    .json(new ApiResponse(201, { url: uploadedImage.secure_url }, "Image uploaded successfully"));
});

export const createTrade = asyncHandler(async (req, res) => {
  const { journalId } = req.params;
  const parsed = parseTradePayload(req.body);

  if (!mongoose.isValidObjectId(journalId)) {
    throw new ApiError(400, "A valid journal ID is required");
  }

  const journal = await Journal.findOne({
    _id: journalId,
    owner: req.user._id,
  });
  if (!journal) throw new ApiError(404, "Journal not found");

  const trade = await Trade.create({
    ...parsed,
    owner: req.user._id,
    journal: journal._id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, serializeTrade(trade), "Trade logged successfully"));
});

export const updateTrade = asyncHandler(async (req, res) => {
  const { journalId, tradeId } = req.params;

  if (!mongoose.isValidObjectId(journalId) || !mongoose.isValidObjectId(tradeId)) {
    throw new ApiError(400, "A valid journal and trade ID are required");
  }

  const journal = await Journal.findOne({ _id: journalId, owner: req.user._id });
  if (!journal) {
    throw new ApiError(404, "Journal not found");
  }

  const parsed = parseTradePayload(req.body);

  const trade = await Trade.findOneAndUpdate(
    { _id: tradeId, journal: journal._id, owner: req.user._id },
    { ...parsed },
    { new: true }
  );

  if (!trade) {
    throw new ApiError(404, "Trade not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, serializeTrade(trade), "Trade updated successfully"));
});

export const deleteTrade = asyncHandler(async (req, res) => {
  const { journalId, tradeId } = req.params;

  if (!mongoose.isValidObjectId(journalId) || !mongoose.isValidObjectId(tradeId)) {
    throw new ApiError(400, "A valid journal and trade ID are required");
  }

  const journal = await Journal.findOne({ _id: journalId, owner: req.user._id });
  if (!journal) {
    throw new ApiError(404, "Journal not found");
  }

  const trade = await Trade.findOneAndDelete({ _id: tradeId, journal: journal._id, owner: req.user._id });
  if (!trade) {
    throw new ApiError(404, "Trade not found");
  }

  return res.status(200).json(new ApiResponse(200, { journalId, tradeId }, "Trade deleted successfully"));
});