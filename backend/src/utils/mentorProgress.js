import crypto from "node:crypto";
import { MentorProgress } from "../models/mentorProgress.models.js";
import { Trade } from "../models/trade.models.js";
import { aiLimits } from "./aiQuota.js";

export const mentorTarget = () => aiLimits().firstTrades;

/**
 * Identity of a trade for counting purposes: what was traded, when, which way, at what price and size.
 * Notes, screenshots, exit, stop and custom properties are left out on purpose: a copy of a trade with a tweaked
 * note or exit is still the same trade. (Edits never reach this at all: only creating a trade can add a point.)
 */
export const tradeFingerprint = (trade) => {
  const day = new Date(trade.date).toISOString().slice(0, 10);
  const key = [
    String(trade.assetName ?? "").trim().toLowerCase(),
    day,
    trade.direction,
    Number(trade.entryPrice),
    Number(trade.quantity),
  ].join("|");
  return crypto.createHash("sha1").update(key).digest("hex").slice(0, 16);
};

const serialize = (doc, target) => {
  const count = Math.min(doc?.fingerprints?.length ?? 0, target);
  const completed = count >= target;
  return {
    count,
    target,
    completed,
    celebrated: Boolean(doc?.celebratedAt) || Boolean(doc?.legacy),
    badge: completed && !doc?.legacy,
    completedAt: doc?.completedAt ? new Date(doc.completedAt).toISOString() : null,
  };
};

/**
 * Makes sure the trader has a progress row. The first time, it is seeded from the trades they already have (distinct
 * ones only), so nobody starts again from zero. Someone who is already past the target is marked `legacy`.
 */
const ensureProgress = async (ownerId, excludeTradeId = null) => {
  const existing = await MentorProgress.findOne({ owner: ownerId });
  if (existing) return existing;

  const target = mentorTarget();
  const tradeFilter = { owner: ownerId };
  if (excludeTradeId) tradeFilter._id = { $ne: excludeTradeId };
  const rows = await Trade.find(tradeFilter).sort({ createdAt: 1 }).limit(500).select("assetName date direction entryPrice quantity").lean();
  const fingerprints = [...new Set(rows.map(tradeFingerprint))].slice(0, target);
  const done = fingerprints.length >= target;

  try {
    return await MentorProgress.create({
      owner: ownerId,
      fingerprints,
      completedAt: done ? new Date() : null,
      celebratedAt: done ? new Date() : null,
      legacy: done,
    });
  } catch (error) {
    if (error?.code === 11000) return MentorProgress.findOne({ owner: ownerId }); // another request created it first
    throw error;
  }
};

export const getMentorProgress = async (ownerId) => serialize(await ensureProgress(ownerId), mentorTarget());

/** Called after a trade is created (never after an edit). A fingerprint that already counted adds nothing. */
export const recordNewTrade = async (ownerId, parsedTrade, createdTradeId) => {
  const target = mentorTarget();
  await ensureProgress(ownerId, createdTradeId);

  await MentorProgress.updateOne(
    {
      owner: ownerId,
      fingerprints: { $ne: tradeFingerprint(parsedTrade) },
      $expr: { $lt: [{ $size: "$fingerprints" }, target] },
    },
    { $push: { fingerprints: tradeFingerprint(parsedTrade) } }
  );

  const doc = await MentorProgress.findOneAndUpdate(
    { owner: ownerId, completedAt: null, $expr: { $gte: [{ $size: "$fingerprints" }, target] } },
    { $set: { completedAt: new Date() } },
    { new: true }
  );
  return serialize(doc ?? (await MentorProgress.findOne({ owner: ownerId })), target);
};

export const markCelebrated = async (ownerId) => {
  await ensureProgress(ownerId);
  const doc = await MentorProgress.findOneAndUpdate(
    { owner: ownerId, celebratedAt: null },
    { $set: { celebratedAt: new Date() } },
    { new: true }
  );
  return serialize(doc ?? (await MentorProgress.findOne({ owner: ownerId })), mentorTarget());
};
