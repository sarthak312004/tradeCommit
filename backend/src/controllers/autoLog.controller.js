import mongoose from "mongoose";
import { Journal } from "../models/journal.models.js";
import { Trade } from "../models/trade.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { assertOwnedResourceWritable } from "../utils/readOnlyResources.js";
import {
  SUPPORTED_BROKER_IDS,
  applyNormalizedAutoLogItems,
  assertAutoLogEntitled,
  generateWebhookToken,
  normalizeBrokerPayload,
  withJournalLock,
} from "../utils/autoLogWebhook.js";
import { recordNewTrade } from "../utils/mentorProgress.js";
import { ONBOARDING_ACTION, recordOnboardingActionSafely } from "../utils/onboardingProgress.js";

const webhookPath = "/api/v1/webhooks/journal/";

const buildWebhookUrl = (req, token) => {
  const configuredBase = (process.env.PUBLIC_API_URL || process.env.BACKEND_URL || "").trim();
  if (configuredBase) {
    let parsed;
    try {
      parsed = new URL(configuredBase);
    } catch {
      throw new ApiError(500, "The public API URL is misconfigured");
    }
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new ApiError(500, "The public API URL is invalid");
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.toString().replace(/\/$/, "")}${webhookPath}${token}`;
  }

  const host = req.get("host");
  if (!host) throw new ApiError(500, "The public API host is unavailable");
  let origin;
  try {
    origin = new URL(`${req.protocol}://${host}`);
  } catch {
    throw new ApiError(500, "The public API host is invalid");
  }
  if (origin.protocol !== "https:" && origin.protocol !== "http:") {
    throw new ApiError(500, "The public API host must use HTTP or HTTPS");
  }
  return `${origin.origin}${webhookPath}${token}`;
};

const serializeAutoLogConfig = (req, journal) => ({
  enabled: Boolean(journal.autoLog?.enabled),
  brokerId: SUPPORTED_BROKER_IDS.includes(journal.autoLog?.brokerId)
    ? journal.autoLog.brokerId
    : "custom",
  webhookUrl: buildWebhookUrl(req, journal.autoLog?.webhookToken || ""),
  totalLoggedCount: Number(journal.autoLog?.totalLoggedCount ?? 0),
  lastReceivedAt: journal.autoLog?.lastReceivedAt
    ? new Date(journal.autoLog.lastReceivedAt).toISOString()
    : null,
  lastStatus: journal.autoLog?.lastStatus || "idle",
  lastMessage: journal.autoLog?.lastMessage || "",
});

const loadOwnedJournal = async (journalId, userId) => {
  if (!mongoose.isValidObjectId(journalId)) {
    throw new ApiError(400, "A valid journal ID is required");
  }
  const journal = await Journal.findOne({ _id: journalId, owner: userId }).select(
    "+autoLog.webhookToken +autoLog.processedOrderIds"
  );
  if (!journal) throw new ApiError(404, "Journal not found");
  return journal;
};

const assertJournalWritable = (user, journal) =>
  assertOwnedResourceWritable({
    user,
    Model: Journal,
    resource: journal,
    limitKey: "maxJournals",
    feature: "readonly_journal",
  });

export const getJournalAutoLogConfig = asyncHandler(async (req, res) => {
  assertAutoLogEntitled(req.user);
  const journal = await loadOwnedJournal(req.params.journalId, req.user._id);

  if (!journal.autoLog?.webhookToken) {
    journal.autoLog.webhookToken = generateWebhookToken();
    await journal.save();
  }

  return res
    .status(200)
    .json(new ApiResponse(200, serializeAutoLogConfig(req, journal), "Auto-log configuration fetched"));
});

export const updateJournalAutoLogConfig = asyncHandler(async (req, res) => {
  assertAutoLogEntitled(req.user);
  const journal = await loadOwnedJournal(req.params.journalId, req.user._id);
  await assertJournalWritable(req.user, journal);

  const { enabled, brokerId } = req.body ?? {};
  if (enabled !== undefined && typeof enabled !== "boolean") {
    throw new ApiError(400, "enabled must be true or false");
  }
  if (brokerId !== undefined && typeof brokerId !== "string") {
    throw new ApiError(400, "Unsupported broker selection");
  }
  const nextBrokerId = brokerId === undefined
    ? journal.autoLog?.brokerId || "custom"
    : brokerId.trim().toLowerCase();
  if (!SUPPORTED_BROKER_IDS.includes(nextBrokerId)) {
    throw new ApiError(400, "Unsupported broker selection");
  }

  journal.autoLog.enabled = enabled ?? Boolean(journal.autoLog.enabled);
  journal.autoLog.brokerId = nextBrokerId;
  journal.autoLog.webhookToken ||= generateWebhookToken();
  await journal.save();

  return res
    .status(200)
    .json(new ApiResponse(200, serializeAutoLogConfig(req, journal), "Auto-log settings saved"));
});

export const rotateJournalWebhookToken = asyncHandler(async (req, res) => {
  assertAutoLogEntitled(req.user);
  const journal = await loadOwnedJournal(req.params.journalId, req.user._id);
  await assertJournalWritable(req.user, journal);

  journal.autoLog.webhookToken = generateWebhookToken();
  await journal.save();

  return res
    .status(200)
    .json(new ApiResponse(200, serializeAutoLogConfig(req, journal), "Webhook URL regenerated"));
});

export const receiveJournalWebhook = asyncHandler(async (req, res) => {
  const token = String(req.params.webhookToken ?? "");
  if (!/^tcwh_[a-f0-9]{48}$/.test(token)) {
    throw new ApiError(401, "Invalid webhook token");
  }

  const found = await Journal.findOne({ "autoLog.webhookToken": token })
    .select("_id owner autoLog.enabled");
  if (!found) throw new ApiError(404, "Webhook endpoint not found");
  if (!found.autoLog?.enabled) {
    throw new ApiError(403, "Auto-logging is currently paused for this journal");
  }

  return withJournalLock(found._id, async () => {
    const journal = await Journal.findById(found._id).select("+autoLog.processedOrderIds");
    if (!journal?.autoLog?.enabled) {
      throw new ApiError(403, "Auto-logging is currently paused for this journal");
    }

    const ownerUser = await User.findById(journal.owner);
    if (!ownerUser) throw new ApiError(404, "Journal owner not found");
    assertAutoLogEntitled(ownerUser);
    await assertJournalWritable(ownerUser, journal);

    const items = normalizeBrokerPayload(req.body, journal.autoLog?.brokerId);
    const receivedAt = new Date();
    if (items.length === 0) {
      journal.autoLog.lastReceivedAt = receivedAt;
      journal.autoLog.lastStatus = "ok";
      journal.autoLog.lastMessage = "Event ignored (no filled execution)";
      await journal.save();
      return res.status(200).json(
        new ApiResponse(200, { loggedCount: 0, skippedDuplicates: 0 }, journal.autoLog.lastMessage)
      );
    }

    const result = await applyNormalizedAutoLogItems({
      journal,
      ownerUser,
      items,
      TradeModel: Trade,
    });

    journal.autoLog.processedOrderIds = result.processedOrderIds;
    journal.autoLog.totalLoggedCount = Number(journal.autoLog.totalLoggedCount ?? 0) + result.loggedCount;
    journal.autoLog.lastReceivedAt = receivedAt;
    journal.autoLog.lastStatus = "ok";
    journal.autoLog.lastMessage = result.loggedCount > 0
      ? `Auto-logged ${result.loggedCount} ${result.loggedCount === 1 ? "trade" : "trades"} (${items[0].assetName})`
      : `Duplicate execution ignored (${items[0].assetName})`;
    await journal.save();

    for (const trade of result.newTrades) {
      try {
        await recordNewTrade(ownerUser._id, trade, trade._id);
      } catch (error) {
        console.error("[auto-log] mentor progress update failed", error);
      }
    }
    if (result.loggedCount > 0) {
      await recordOnboardingActionSafely(
        ownerUser._id,
        ONBOARDING_ACTION.TRADE_LOGGED,
        "webhook trade creation"
      );
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          loggedCount: result.loggedCount,
          skippedDuplicates: result.skippedDuplicates,
        },
        journal.autoLog.lastMessage
      )
    );
  });
});
