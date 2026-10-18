import { Router } from "express";
import { createAiReview, getAiQuota, getAiReview } from "../controllers/aiReview.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

// mounted at /api/v1/journals/:journalId/ai-review
//
// GET  /?weekStart=YYYY-MM-DD  saved review + week numbers + `access` (may a new review be generated now, and why not).
//                              Never calls Gemini and never uses any allowance.
// POST /  { weekStart }        returns the saved review if it is current; otherwise, if unlocked and within the caps and
//                              the shared daily budget, queues a Gemini call and saves the result.
//                              403 = not enough new trades yet, 429 = your cap reached / mentor busy, 400 = no strategy or no trades.
// GET  /quota                 the trader's allowance (1 a day, 3 a week) shared by weekly and date-range reviews:
//                              { usage, blocked, reason, nextAvailableAt, message, generating }. Never calls Gemini.
const router = Router({ mergeParams: true });

router.get("/quota", verifyJWT, getAiQuota);
router.get("/", verifyJWT, getAiReview);
router.post("/", verifyJWT, createAiReview);

export { router as aiReviewRouter };
