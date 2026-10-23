import crypto from "node:crypto";
import mongoose from "mongoose";
import { AiRangeReview } from "../models/aiRangeReview.models.js";
import { AiReview } from "../models/aiReview.models.js";
import { Journal } from "../models/journal.models.js";
import { PlanEntry } from "../models/planEntry.models.js";
import { Planner } from "../models/planner.models.js";
import { Trade } from "../models/trade.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sanitizeReview, REVIEW_SCHEMA } from "../utils/aiMentorPrompt.js";
import { buildRangePrompt, RANGE_SYSTEM_PROMPT } from "../utils/aiRangePrompt.js";
import { isUserBusy, markUserBusy, releaseUser } from "../utils/aiJobGuard.js";
import { evaluateAccess, withUsageReservation } from "../utils/aiQuota.js";
import { generateJson } from "../utils/gemini.js";
import { runQueued } from "../utils/geminiQueue.js";
import { htmlToPlainText } from "../utils/richText.js";
import { findLastCommitment } from "../utils/flywheel.js";
import { addDays, dateKey, isDateKey, summaryStats } from "../utils/tradeStats.js";

// A strategy shorter than this has no rules to check trades against.
const MIN_STRATEGY_LENGTH = 15;
const MAX_PLANS = 80; // plans sent to the mentor for one range
const MAX_PLAN_DAYS_IN_REVIEW = 40;
const HISTORY_PAGE = 20;
const HISTORY_MAX_PAGE = 50;
// one generation per journal-range at a time: a double click shares the same Gemini call
const inFlight = new Map();

const maxRangeDays = () => {
  const value = Number.parseInt(process.env.AI_RANGE_MAX_DAYS ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : 1830; // five years and a few days
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const daysInclusive = (start, end) => Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86_400_000) + 1;

const validateRange = (start, end) => {
  if (!isDateKey(start) || !isDateKey(end)) throw new ApiError(400, "start and end must be dates like 2026-09-01");
  if (start > end) throw new ApiError(400, "The range must start on or before the day it ends");
  // one day of slack: a trader east of UTC can already be on tomorrow's date
  if (end > addDays(todayKey(), 1)) throw new ApiError(400, "The range cannot end in the future");
  const limit = maxRangeDays();
  if (daysInclusive(start, end) > limit) throw new ApiError(400, `Pick a range of at most ${limit} days. For longer stretches, review them in parts.`);
};

const requireJournalId = (req) => {
  const { journalId } = req.params;
  if (!mongoose.isValidObjectId(journalId)) throw new ApiError(400, "A valid journal ID is required");
  return journalId;
};

/** Loads everything a range review needs; every query is scoped to the signed-in owner. */
const loadRange = async ({ ownerId, journalId, start, end }) => {
  validateRange(start, end);

  const journal = await Journal.findOne({ _id: journalId, owner: ownerId }).lean();
  if (!journal) throw new ApiError(404, "Journal not found");

  const allTradesToDate = await Trade.find({
    journal: journal._id,
    owner: ownerId,
    date: { $lte: new Date(`${end}T23:59:59.999Z`) },
  })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  const rangeTrades = allTradesToDate.filter((trade) => {
    const key = dateKey(trade.date);
    return key >= start && key <= end;
  });
  const priorTrades = allTradesToDate.filter((trade) => dateKey(trade.date) < start);

  const planners = await Planner.find({ linkedJournal: journal._id, owner: ownerId }).select("name type").sort({ createdAt: 1 }).lean();
  let planEntries = [];
  let plansTruncated = false;
  if (planners.length) {
    // newest plans first so a long range keeps the most recent ones; flipped back to chronological afterwards
    const found = await PlanEntry.find({ planner: { $in: planners.map((planner) => planner._id) }, owner: ownerId, date: { $gte: start, $lte: end } })
      .sort({ date: -1, createdAt: -1 })
      .limit(MAX_PLANS + 1)
      .lean();
    plansTruncated = found.length > MAX_PLANS;
    planEntries = found.slice(0, MAX_PLANS).reverse();
  }

  const strategy = htmlToPlainText(journal.context?.strategy ?? "");
  const attributes = (journal.context?.attributes ?? []).map(({ label, type }) => [label, type]);
  const plansFingerprint = planners.length ? [planners.map((planner) => String(planner._id)), planEntries.map((entry) => [String(entry._id), new Date(entry.updatedAt ?? 0).getTime()])] : [];

  // strategy, custom fields and connected plans without the trades: a change here unlocks a refresh on its own
  const contextHash = crypto.createHash("sha256").update(JSON.stringify({ mode: journal.mode ?? "live", strategy, attributes, plans: plansFingerprint })).digest("hex");
  const inputHash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ start, end, mode: journal.mode ?? "live", strategy, attributes, trades: rangeTrades.map((trade) => [String(trade._id), new Date(trade.updatedAt ?? 0).getTime()]), plans: plansFingerprint }))
    .digest("hex");

  return {
    journal,
    rangeStart: start,
    rangeEnd: end,
    rangeTrades,
    priorTrades,
    allTradesToDate,
    planners,
    planEntries,
    plansTruncated,
    hasStrategy: strategy.length >= MIN_STRATEGY_LENGTH,
    inputHash,
    contextHash,
    // --- the shape aiQuota.evaluateAccess reads (it was written for weeks) ---
    weekTrades: rangeTrades,
    isClosed: end < todayKey(),
    strictMinimum: true, // a range always needs the full minimum of trades, even when it lies in the past
    scopeLabel: "this date range",
  };
};

// { trades, closed, netPnl, winRate, expectancyR, rewardRisk, payoffRatio, avgRrr (legacy alias of expectancyR) }
const rangeStats = summaryStats;

const serialize = (range, saved, access) => ({
  kind: "range",
  id: saved?._id ? String(saved._id) : null,
  rangeStart: range.rangeStart,
  rangeEnd: range.rangeEnd,
  days: daysInclusive(range.rangeStart, range.rangeEnd),
  currency: range.journal.currency,
  hasStrategy: range.hasStrategy,
  tradeCount: range.rangeTrades.length,
  planner: { connected: range.planners.length, plans: range.planEntries.length },
  stats: rangeStats(range.rangeTrades),
  review: saved?.review ?? null,
  model: saved?.model ?? null,
  generatedAt: saved?.updatedAt ? new Date(saved.updatedAt).toISOString() : null,
  stale: Boolean(saved) && saved.inputHash !== range.inputHash,
  access,
});

const findSaved = (range) => AiRangeReview.findOne({ journal: range.journal._id, owner: range.journal.owner, rangeStart: range.rangeStart, rangeEnd: range.rangeEnd }).lean();

const generate = async (range) => {
  const ownerId = range.journal.owner;
  // the flywheel link: what the previous review asked the trader to carry into this period
  const lastCommitment = await findLastCommitment({ journalId: range.journal._id, ownerId, before: range.rangeStart });
  const { prompt, tradeLabels, hasPlanContext, hasLast, closedCount } = buildRangePrompt({ ...range, lastCommitment });

  // Reserved first (shared daily budget), counted only once the review is saved. Any failure on the way, such as a
  // Gemini rate limit, a full queue, a timeout or an unusable answer, deletes the reservation: no allowance is used.
  return withUsageReservation({ ownerId, journalId: range.journal._id, weekStart: range.rangeStart }, async () => {
    const { result, model } = await runQueued(() => generateJson({ system: RANGE_SYSTEM_PROMPT, prompt, schema: REVIEW_SCHEMA }));
    const review = sanitizeReview(result, tradeLabels, { hasPlanContext, weekStart: range.rangeStart, weekEnd: range.rangeEnd, maxPlanDays: MAX_PLAN_DAYS_IN_REVIEW, hasLast, closedCount });
    if (!review.summary || !review.headline) throw new ApiError(502, "The AI returned an incomplete review. Please try again.");

    return AiRangeReview.findOneAndUpdate(
      { journal: range.journal._id, rangeStart: range.rangeStart, rangeEnd: range.rangeEnd },
      {
        $set: {
          owner: ownerId,
          inputHash: range.inputHash,
          contextHash: range.contextHash,
          reviewedTradeCount: range.rangeTrades.length,
          stats: rangeStats(range.rangeTrades),
          model,
          review,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  });
};

// GET /api/v1/journals/:journalId/ai-range-reviews/preview?start=YYYY-MM-DD&end=YYYY-MM-DD
// Cheap, never calls the AI: the saved review for that exact range (if any), the range's numbers and `access`
// (may a new review be generated now, and why not).
export const previewRangeReview = asyncHandler(async (req, res) => {
  const range = await loadRange({ ownerId: req.user._id, journalId: requireJournalId(req), start: req.query?.start, end: req.query?.end });
  const saved = await findSaved(range);
  const access = await evaluateAccess({ week: range, saved, ownerId: req.user._id });
  return res.status(200).json(new ApiResponse(200, serialize(range, saved, access), "AI range review fetched"));
});

// POST /api/v1/journals/:journalId/ai-range-reviews   { start, end }
// Returns the saved review when it is still current. Otherwise it checks the minimum of trades, the trader's caps
// (1 a day, 3 a week, shared with weekly reviews) and the shared daily budget, then asks Gemini and saves the result.
export const createRangeReview = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;
  const range = await loadRange({ ownerId, journalId: requireJournalId(req), start: req.body?.start, end: req.body?.end });
  if (!range.hasStrategy) {
    throw new ApiError(400, "Write your strategy in this journal's Context first, so the mentor has rules to check your trades against.");
  }
  if (range.rangeTrades.length === 0) throw new ApiError(400, "There are no trades in this date range to review.");

  const key = `${range.journal._id}:${range.rangeStart}:${range.rangeEnd}`;
  const respond = async (saved) => {
    const access = await evaluateAccess({ week: range, saved, ownerId });
    return res.status(200).json(new ApiResponse(200, serialize(range, saved, access), "AI range review ready"));
  };

  const saved = await findSaved(range);
  // a current review is always returned as is: the same inputs would only spend quota to get the same answer
  if (saved && saved.inputHash === range.inputHash) {
    res.locals.skipRateLimit = true;
    return respond(saved);
  }

  // a double click joins the generation that is already running
  if (inFlight.has(key)) {
    res.locals.skipRateLimit = true;
    return respond(await inFlight.get(key));
  }

  const access = await evaluateAccess({ week: range, saved, ownerId });
  if (!access.canGenerate) {
    throw new ApiError(access.reason === "not_enough_trades" ? 403 : 429, access.message || "A new review is not available right now.");
  }

  // no awaits between these checks and the set() calls below, so two requests cannot both start
  if (inFlight.has(key)) {
    res.locals.skipRateLimit = true;
    return respond(await inFlight.get(key));
  }
  if (isUserBusy(ownerId)) throw new ApiError(429, "Your other review is still being written. Wait for it to finish, then try again.");

  const job = generate(range).finally(() => {
    inFlight.delete(key);
    releaseUser(ownerId);
  });
  inFlight.set(key, job);
  markUserBusy(ownerId, key);

  return respond(await job);
});

// GET /api/v1/journals/:journalId/ai-range-reviews/carry-forward
// The one change the latest saved review asked the trader to carry into their next plan, so the planner can show it
// while a plan is being written: { commitment: { start, end, rule, planLine, checkpoint, source } | null }. Never calls the AI.
export const getCarryForward = asyncHandler(async (req, res) => {
  const journalId = requireJournalId(req);
  const journal = await Journal.findOne({ _id: journalId, owner: req.user._id }).select("_id").lean();
  if (!journal) throw new ApiError(404, "Journal not found");
  // no upper bound: the latest review wins, including a weekly one whose week is still running
  const commitment = await findLastCommitment({ journalId: journal._id, ownerId: req.user._id, before: "9999-12-31" });
  return res.status(200).json(new ApiResponse(200, { commitment }, "Carry-forward fetched"));
});

// GET /api/v1/journals/:journalId/ai-range-reviews/:reviewId
// Opens one saved range review from the history list (with its current stale flag and access). Never calls the AI.
export const getRangeReviewById = asyncHandler(async (req, res) => {
  const journalId = requireJournalId(req);
  const { reviewId } = req.params;
  if (!mongoose.isValidObjectId(reviewId)) throw new ApiError(400, "A valid review ID is required");

  const saved = await AiRangeReview.findOne({ _id: reviewId, journal: journalId, owner: req.user._id }).lean();
  if (!saved) throw new ApiError(404, "Review not found");

  const range = await loadRange({ ownerId: req.user._id, journalId, start: saved.rangeStart, end: saved.rangeEnd });
  const access = await evaluateAccess({ week: range, saved, ownerId: req.user._id });
  return res.status(200).json(new ApiResponse(200, serialize(range, saved, access), "AI range review fetched"));
});

// GET /api/v1/journals/:journalId/ai-range-reviews?limit=20&before=<ISO date>
// Every past review of this journal, weekly and date-range together, newest first. Light rows only (no full review),
// so browsing the history is free and fast. Page with `before` = the previous page's `nextBefore`.
export const listAiReviewHistory = asyncHandler(async (req, res) => {
  const journalId = requireJournalId(req);
  const ownerId = req.user._id;

  const journal = await Journal.findOne({ _id: journalId, owner: ownerId }).select("_id currency").lean();
  if (!journal) throw new ApiError(404, "Journal not found");

  const asked = Number.parseInt(req.query?.limit ?? "", 10);
  const limit = Number.isFinite(asked) && asked > 0 ? Math.min(asked, HISTORY_MAX_PAGE) : HISTORY_PAGE;
  const before = req.query?.before ? new Date(req.query.before) : null;
  if (before && Number.isNaN(before.getTime())) throw new ApiError(400, "before must be an ISO date");
  const when = before ? { updatedAt: { $lt: before } } : {};
  const pick = "review.headline review.discipline review.strategyFeedback.verdict reviewedTradeCount model updatedAt";

  const [ranges, weeks] = await Promise.all([
    AiRangeReview.find({ journal: journal._id, owner: ownerId, ...when }).sort({ updatedAt: -1 }).limit(limit + 1).select(`rangeStart rangeEnd stats ${pick}`).lean(),
    AiReview.find({ journal: journal._id, owner: ownerId, ...when }).sort({ updatedAt: -1 }).limit(limit + 1).select(`weekStart ${pick}`).lean(),
  ]);

  const row = (doc, kind) => ({
    kind,
    id: String(doc._id),
    start: kind === "range" ? doc.rangeStart : doc.weekStart,
    end: kind === "range" ? doc.rangeEnd : addDays(doc.weekStart, 6),
    headline: doc.review?.headline ?? "",
    discipline: { verdict: doc.review?.discipline?.verdict ?? "cannot_assess", score: doc.review?.discipline?.score ?? null },
    strategyVerdict: doc.review?.strategyFeedback?.verdict ?? null,
    tradeCount: doc.reviewedTradeCount ?? 0,
    stats: doc.stats ?? null,
    model: doc.model ?? null,
    generatedAt: new Date(doc.updatedAt).toISOString(),
  });

  const merged = [...ranges.map((doc) => row(doc, "range")), ...weeks.map((doc) => row(doc, "week"))].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  const items = merged.slice(0, limit);
  const hasMore = merged.length > limit;

  return res.status(200).json(new ApiResponse(200, { currency: journal.currency, items, hasMore, nextBefore: hasMore ? items[items.length - 1].generatedAt : null }, "AI review history fetched"));
});
