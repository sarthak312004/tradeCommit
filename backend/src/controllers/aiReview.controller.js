import crypto from "node:crypto";
import mongoose from "mongoose";
import { AiReview } from "../models/aiReview.models.js";
import { Journal } from "../models/journal.models.js";
import { PlanEntry } from "../models/planEntry.models.js";
import { Planner } from "../models/planner.models.js";
import { Trade } from "../models/trade.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buildMentorPrompt, REVIEW_SCHEMA, sanitizeReview, SYSTEM_PROMPT } from "../utils/aiMentorPrompt.js";
import { evaluateAccess, getQuotaSnapshot, withUsageReservation } from "../utils/aiQuota.js";
import { isUserBusy, markUserBusy, releaseUser } from "../utils/aiJobGuard.js";
import { generateJson } from "../utils/gemini.js";
import { runQueued } from "../utils/geminiQueue.js";
import { htmlToPlainText } from "../utils/richText.js";
import { findLastCommitment } from "../utils/flywheel.js";
import { addDays, dateKey, isDateKey, mondayOf, summaryStats } from "../utils/tradeStats.js";

// A strategy shorter than this has no rules to check trades against.
const MIN_STRATEGY_LENGTH = 15;
// one generation per journal-week at a time: a double click shares the same Gemini call
const inFlight = new Map();
// ...and one generation per trader at a time (shared with date-range reviews, see aiJobGuard.js)

const todayKey = () => new Date().toISOString().slice(0, 10);

/** Loads everything a review needs; every query is scoped to the signed-in owner. */
const loadWeek = async (req) => {
  const { journalId } = req.params;
  if (!mongoose.isValidObjectId(journalId)) throw new ApiError(400, "A valid journal ID is required");

  const requested = req.method === "GET" ? req.query?.weekStart : req.body?.weekStart;
  if (requested !== undefined && !isDateKey(requested)) throw new ApiError(400, "weekStart must be a date like 2026-10-05");
  const weekStart = mondayOf(requested ?? todayKey());
  const weekEnd = addDays(weekStart, 6);

  const journal = await Journal.findOne({ _id: journalId, owner: req.user._id }).lean();
  if (!journal) throw new ApiError(404, "Journal not found");

  const allTradesToDate = await Trade.find({
    journal: journal._id,
    owner: req.user._id,
    date: { $lte: new Date(`${weekEnd}T23:59:59.999Z`) },
  })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  const weekTrades = allTradesToDate.filter((trade) => {
    const key = dateKey(trade.date);
    return key >= weekStart && key <= weekEnd;
  });
  const priorTrades = allTradesToDate.filter((trade) => dateKey(trade.date) < weekStart);

  // Planners the trader connected to this journal, and the plans they wrote for this week. The mentor compares
  // them with the executed trades. Nothing is loaded (and the hash is unchanged) when no planner is connected.
  const planners = await Planner.find({ linkedJournal: journal._id, owner: req.user._id }).select("name type").sort({ createdAt: 1 }).lean();
  const planEntries = planners.length
    ? await PlanEntry.find({
        planner: { $in: planners.map((planner) => planner._id) },
        owner: req.user._id,
        date: { $gte: weekStart, $lte: weekEnd },
      })
        .sort({ date: 1, createdAt: 1 })
        .lean()
    : [];

  // the strategy is stored as HTML (or plain text in older journals): judge its length by the visible text
  const strategy = htmlToPlainText(journal.context?.strategy ?? "");
  // strategy, custom fields and connected plans without the trades: a change here unlocks a refresh on its own
  const contextHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        mode: journal.mode ?? "live",
        strategy,
        attributes: (journal.context?.attributes ?? []).map(({ label, type }) => [label, type]),
        plans: planners.length ? [planners.map((planner) => String(planner._id)), planEntries.map((entry) => [String(entry._id), new Date(entry.updatedAt ?? 0).getTime()])] : [],
      })
    )
    .digest("hex");
  // Include mode in the hash so a live/backtest switch invalidates a review generated under different assumptions.
  const inputHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        weekStart,
        mode: journal.mode ?? "live",
        strategy,
        attributes: (journal.context?.attributes ?? []).map(({ label, type }) => [label, type]),
        trades: allTradesToDate.map((trade) => [String(trade._id), new Date(trade.updatedAt ?? 0).getTime()]),
        ...(planners.length
          ? {
              plans: [
                planners.map((planner) => String(planner._id)),
                planEntries.map((entry) => [String(entry._id), new Date(entry.updatedAt ?? 0).getTime()]),
              ],
            }
          : {}),
      })
    )
    .digest("hex");

  return { journal, weekStart, weekEnd, weekTrades, priorTrades, allTradesToDate, planners, planEntries, hasStrategy: strategy.length >= MIN_STRATEGY_LENGTH, inputHash, contextHash, isClosed: weekEnd < todayKey() };
};

// { trades, closed, netPnl, winRate, expectancyR, rewardRisk, payoffRatio, avgRrr (legacy alias of expectancyR) }
const weekSummary = summaryStats;

const serialize = (week, saved, access) => ({
  weekStart: week.weekStart,
  weekEnd: week.weekEnd,
  currency: week.journal.currency,
  hasStrategy: week.hasStrategy,
  tradeCount: week.weekTrades.length,
  // how many planners are connected to this journal, and how many plans they hold for this week
  planner: { connected: week.planners.length, plans: week.planEntries.length },
  week: weekSummary(week.weekTrades),
  review: saved?.review ?? null,
  model: saved?.model ?? null,
  generatedAt: saved?.updatedAt ? new Date(saved.updatedAt).toISOString() : null,
  // the journal's trades or strategy changed after this review was written
  stale: Boolean(saved) && saved.inputHash !== week.inputHash,
  // whether a new review may be generated now (unlock rule, the trader's caps, the shared daily budget) and why not
  access,
});

const generate = async (week) => {
  const ownerId = week.journal.owner;
  // the flywheel link: what the previous review asked the trader to carry into this week
  const lastCommitment = await findLastCommitment({ journalId: week.journal._id, ownerId, before: week.weekStart });
  const { prompt, tradeLabels, leakReport, hasPlanContext, hasLast, closedCount } = buildMentorPrompt({ ...week, lastCommitment });
  const generationStarted = Date.now();

  // The generation is reserved first so concurrent traders cannot overshoot the shared daily budget, but it only
  // counts once the review is saved. If Gemini is rate limited, the queue is full, the call times out or the answer
  // is unusable, the reservation is deleted and the trader's daily/weekly allowance is untouched.
  return withUsageReservation({ ownerId, journalId: week.journal._id, weekStart: week.weekStart }, async () => {
    const { result, model } = await runQueued(() => generateJson({ system: SYSTEM_PROMPT, prompt, schema: REVIEW_SCHEMA }));
    const review = sanitizeReview(result, tradeLabels, { hasPlanContext, weekStart: week.weekStart, weekEnd: week.weekEnd, hasLast, closedCount, leakReport });
    if (!review.summary || !review.headline) throw new ApiError(502, "The AI returned an incomplete review. Please try again.");

    const persistStarted = Date.now();
    const saved = await AiReview.findOneAndUpdate(
      { journal: week.journal._id, weekStart: week.weekStart },
      { $set: { owner: ownerId, inputHash: week.inputHash, contextHash: week.contextHash, reviewedTradeCount: week.weekTrades.length, model, review } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    console.log(`[ai-review] weekly saved in ${Date.now() - persistStarted}ms (total ${Date.now() - generationStarted}ms)`);
    return saved;
  });
};

// GET /api/v1/journals/:journalId/ai-review?weekStart=YYYY-MM-DD
// Cheap, never calls the AI: returns the saved review for that week (if any) plus the week's numbers.
export const getAiReview = asyncHandler(async (req, res) => {
  const week = await loadWeek(req);
  const saved = await AiReview.findOne({ journal: week.journal._id, weekStart: week.weekStart }).lean();
  const access = await evaluateAccess({ week, saved, ownerId: req.user._id });
  return res.status(200).json(new ApiResponse(200, serialize(week, saved, access), "AI review fetched"));
});

// POST /api/v1/journals/:journalId/ai-review   { weekStart? }
// Returns the saved review when it is still current. Otherwise it checks that the review is unlocked and within the
// trader's caps and the shared daily budget, then asks Gemini (through the queue) and saves the result.
export const createAiReview = asyncHandler(async (req, res) => {
  const week = await loadWeek(req);
  if (!week.hasStrategy) {
    throw new ApiError(400, "Write your strategy in this journal's Context first, so the mentor has rules to check your trades against.");
  }
  if (week.weekTrades.length === 0) throw new ApiError(400, "There are no trades in this week to review.");

  const ownerId = req.user._id;
  const key = `${week.journal._id}:${week.weekStart}`;
  const respond = async (saved) => {
    const access = await evaluateAccess({ week, saved, ownerId });
    return res.status(200).json(new ApiResponse(200, serialize(week, saved, access), "AI review ready"));
  };

  const saved = await AiReview.findOne({ journal: week.journal._id, weekStart: week.weekStart }).lean();
  // a current review is always returned as is: the same inputs would only spend quota to get the same answer
  if (saved && saved.inputHash === week.inputHash) {
    res.locals.skipRateLimit = true; // nothing was generated, so this request must not count toward the IP limit
    return respond(saved);
  }

  // a double click joins the generation that is already running
  if (inFlight.has(key)) {
    res.locals.skipRateLimit = true;
    return respond(await inFlight.get(key));
  }

  const access = await evaluateAccess({ week, saved, ownerId });
  if (!access.canGenerate) {
    throw new ApiError(access.reason === "not_enough_trades" ? 403 : 429, access.message || "A new review is not available right now.");
  }

  // no awaits between these checks and the set() calls below, so two requests cannot both start
  if (inFlight.has(key)) {
    res.locals.skipRateLimit = true;
    return respond(await inFlight.get(key));
  }
  if (isUserBusy(ownerId)) throw new ApiError(429, "Your other review is still being written. Wait for it to finish, then try again.");

  const job = generate(week).finally(() => {
    inFlight.delete(key);
    releaseUser(ownerId);
  });
  inFlight.set(key, job);
  markUserBusy(ownerId, key);

  return respond(await job);
});

// GET /api/v1/journals/:journalId/ai-review/quota
// The trader's allowance, shared by weekly and date-range reviews (a review written in either counts in both).
// Never calls the AI. The mentor dialog reads it whenever you switch between Weekly and Date range.
export const getAiQuota = asyncHandler(async (req, res) => {
  const { journalId } = req.params;
  if (!mongoose.isValidObjectId(journalId)) throw new ApiError(400, "A valid journal ID is required");
  const journal = await Journal.findOne({ _id: journalId, owner: req.user._id }).select("_id").lean();
  if (!journal) throw new ApiError(404, "Journal not found");
  const quota = await getQuotaSnapshot(req.user._id);
  return res.status(200).json(new ApiResponse(200, quota, "AI review allowance fetched"));
});
