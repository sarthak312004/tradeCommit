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
import { generateJson } from "../utils/gemini.js";
import { htmlToPlainText } from "../utils/richText.js";
import { addDays, computeAnalytics, dateKey, isDateKey, mondayOf } from "../utils/tradeStats.js";

// A strategy shorter than this has no rules to check trades against.
const MIN_STRATEGY_LENGTH = 15;
// Pressing "Regenerate" right after a fresh, still-current review returns it instead of spending quota again.
const REGENERATE_COOLDOWN_MS = 60_000;

// one generation per journal-week at a time: a double click shares the same Gemini call
const inFlight = new Map();

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
  const inputHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        weekStart,
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

  return { journal, weekStart, weekEnd, weekTrades, priorTrades, allTradesToDate, planners, planEntries, hasStrategy: strategy.length >= MIN_STRATEGY_LENGTH, inputHash };
};

const weekSummary = (weekTrades) => {
  const stats = computeAnalytics(weekTrades);
  return { trades: stats.totalTrades, closed: stats.closedTrades, netPnl: stats.netPnl, winRate: stats.winRate, avgRrr: stats.avgRrr };
};

const serialize = (week, saved) => ({
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
});

const generate = async (week) => {
  const { prompt, tradeLabels, hasPlanContext } = buildMentorPrompt(week);
  const { result, model } = await generateJson({ system: SYSTEM_PROMPT, prompt, schema: REVIEW_SCHEMA });
  const review = sanitizeReview(result, tradeLabels, { hasPlanContext, weekStart: week.weekStart, weekEnd: week.weekEnd });
  if (!review.summary || !review.headline) throw new ApiError(502, "The AI returned an incomplete review. Please try again.");

  return AiReview.findOneAndUpdate(
    { journal: week.journal._id, weekStart: week.weekStart },
    { $set: { owner: week.journal.owner, inputHash: week.inputHash, model, review } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
};

// GET /api/v1/journals/:journalId/ai-review?weekStart=YYYY-MM-DD
// Cheap, never calls the AI: returns the saved review for that week (if any) plus the week's numbers.
export const getAiReview = asyncHandler(async (req, res) => {
  const week = await loadWeek(req);
  const saved = await AiReview.findOne({ journal: week.journal._id, weekStart: week.weekStart }).lean();
  return res.status(200).json(new ApiResponse(200, serialize(week, saved), "AI review fetched"));
});

// POST /api/v1/journals/:journalId/ai-review   { weekStart?, force? }
// Returns the saved review when it is still current; otherwise asks Gemini and saves the result.
export const createAiReview = asyncHandler(async (req, res) => {
  const { force } = req.body ?? {};
  if (force !== undefined && typeof force !== "boolean") throw new ApiError(400, "force must be true or false");

  const week = await loadWeek(req);
  if (!week.hasStrategy) {
    throw new ApiError(400, "Write your strategy in this journal's Context first, so the mentor has rules to check your trades against.");
  }
  if (week.weekTrades.length === 0) throw new ApiError(400, "There are no trades in this week to review.");

  const saved = await AiReview.findOne({ journal: week.journal._id, weekStart: week.weekStart }).lean();
  if (saved && saved.inputHash === week.inputHash) {
    const age = Date.now() - new Date(saved.updatedAt).getTime();
    if (!force || age < REGENERATE_COOLDOWN_MS) return res.status(200).json(new ApiResponse(200, serialize(week, saved), "AI review ready"));
  }

  const key = `${week.journal._id}:${week.weekStart}`;
  let job = inFlight.get(key);
  if (!job) {
    job = generate(week).finally(() => inFlight.delete(key));
    inFlight.set(key, job);
  }
  const fresh = await job;

  return res.status(200).json(new ApiResponse(200, serialize(week, fresh), "AI review ready"));
});
