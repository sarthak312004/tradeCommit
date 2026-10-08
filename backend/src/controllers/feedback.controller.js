import { BugReport, BUG_SEVERITIES } from "../models/bugReport.models.js";
import { Feedback, FEEDBACK_AREA_KEYS } from "../models/feedback.models.js";
import { Trade } from "../models/trade.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// The feedback popup appears on its own once a user has logged this many trades (across all journals).
export const FEEDBACK_PROMPT_AFTER_TRADES = 10;

const MAX_MESSAGE_LENGTH = 1000;
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_STEPS_LENGTH = 1000;

/** Returns a trimmed string, "" when the field is absent, and throws when it is present but not text. */
const readText = (value, fieldName) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new ApiError(400, `${fieldName} must be text`);
  return value.trim();
};

// GET /api/v1/feedback/status  -> { handled, shouldPrompt }
// `handled`: the popup was already answered or dismissed (or feedback was sent) and must never show again.
export const getFeedbackStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("feedbackPromptHandled");
  if (!user) throw new ApiError(404, "User not found");

  if (user.feedbackPromptHandled) {
    return res.status(200).json(new ApiResponse(200, { handled: true, shouldPrompt: false }, "Feedback status"));
  }

  const tradeCount = await Trade.countDocuments({ owner: req.user._id });
  return res
    .status(200)
    .json(new ApiResponse(200, { handled: false, shouldPrompt: tradeCount >= FEEDBACK_PROMPT_AFTER_TRADES }, "Feedback status"));
});

// POST /api/v1/feedback/dismiss  -> the user closed the automatic popup without sending anything
export const dismissFeedbackPrompt = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $set: { feedbackPromptHandled: true } });
  return res.status(200).json(new ApiResponse(200, {}, "Dismissed"));
});

// POST /api/v1/feedback   { rating: 1-5, ratings?: { easeOfUse, ui, functionality, journaling }, message?: string }
// `rating` is the overall experience (required); each entry in `ratings` is optional.
export const submitFeedback = asyncHandler(async (req, res) => {
  const { rating, ratings, message } = req.body ?? {};

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(400, "Please rate your overall experience from 1 to 5");
  }

  if (ratings !== undefined && ratings !== null && (typeof ratings !== "object" || Array.isArray(ratings))) {
    throw new ApiError(400, "Ratings must be an object");
  }
  const cleanRatings = {};
  for (const key of FEEDBACK_AREA_KEYS) {
    const value = ratings?.[key];
    if (value === undefined || value === null) continue; // this area was skipped
    if (!Number.isInteger(value) || value < 1 || value > 5) throw new ApiError(400, "Ratings go from 1 to 5");
    cleanRatings[key] = value;
  }

  const cleanMessage = readText(message, "Message");
  if (cleanMessage.length > MAX_MESSAGE_LENGTH) {
    throw new ApiError(400, `Message can be at most ${MAX_MESSAGE_LENGTH} characters`);
  }

  await Feedback.create({ user: req.user._id, rating, ratings: cleanRatings, message: cleanMessage });
  // someone who has already sent feedback should never be nagged by the automatic popup
  await User.updateOne({ _id: req.user._id }, { $set: { feedbackPromptHandled: true } });

  return res.status(201).json(new ApiResponse(201, {}, "Thanks for your feedback"));
});

// POST /api/v1/feedback/bug   { title, description, steps?, severity?, page? }
export const submitBugReport = asyncHandler(async (req, res) => {
  const { title, description, steps, severity, page } = req.body ?? {};

  const cleanTitle = readText(title, "Title");
  const cleanDescription = readText(description, "Description");
  const cleanSteps = readText(steps, "Steps");
  const cleanPage = readText(page, "Page");

  if (!cleanTitle) throw new ApiError(400, "Give the bug a short title");
  if (cleanTitle.length > MAX_TITLE_LENGTH) throw new ApiError(400, `Title can be at most ${MAX_TITLE_LENGTH} characters`);
  if (!cleanDescription) throw new ApiError(400, "Describe what happened");
  if (cleanDescription.length > MAX_DESCRIPTION_LENGTH) {
    throw new ApiError(400, `Description can be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  if (cleanSteps.length > MAX_STEPS_LENGTH) throw new ApiError(400, `Steps can be at most ${MAX_STEPS_LENGTH} characters`);

  const cleanSeverity = severity ?? "minor";
  if (!BUG_SEVERITIES.includes(cleanSeverity)) throw new ApiError(400, "Choose how serious the bug is");

  await BugReport.create({
    user: req.user._id,
    title: cleanTitle,
    description: cleanDescription,
    steps: cleanSteps,
    severity: cleanSeverity,
    page: cleanPage.slice(0, 200),
    userAgent: (req.get("user-agent") ?? "").slice(0, 300),
  });

  return res.status(201).json(new ApiResponse(201, {}, "Thanks for the report"));
});
