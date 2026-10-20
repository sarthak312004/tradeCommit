import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getMentorProgress, markCelebrated } from "../utils/mentorProgress.js";

/** GET /api/v1/progress/mentor: { count, target, completed, celebrated, badge, completedAt }. Never calls the AI. */
export const getMentorUnlockProgress = asyncHandler(async (req, res) => {
  const progress = await getMentorProgress(req.user._id);
  return res.status(200).json(new ApiResponse(200, progress, "Progress fetched successfully"));
});

/** POST /api/v1/progress/mentor/celebrated: the trader has seen the "feedback is here" moment. Safe to repeat. */
export const celebrateMentorUnlock = asyncHandler(async (req, res) => {
  const progress = await markCelebrated(req.user._id);
  return res.status(200).json(new ApiResponse(200, progress, "Progress updated"));
});
