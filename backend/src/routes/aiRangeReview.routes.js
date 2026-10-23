import { Router } from "express";
import { createRangeReview, getCarryForward, getRangeReviewById, listAiReviewHistory, previewRangeReview } from "../controllers/aiRangeReview.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

// mounted at /api/v1/journals/:journalId/ai-range-reviews
//
// GET  /                              history of every saved review of the journal (weekly + date range), newest first.
//                                     ?limit=20&before=<ISO date from the previous page's nextBefore>. Never calls Gemini.
// GET  /preview?start=&end=           saved review for that exact range (if any) + the range's numbers + `access`.
//                                     Never calls Gemini and never uses any allowance.
// POST /  { start, end }              returns the saved review if it is current; otherwise, if the range holds at least
//                                     5 trades (the one unlock rule, also for refreshing a changed range) and the trader is
//                                     within the caps (1 a day, 3 a week, shared with the old weekly reviews) and the shared
//                                     daily budget, queues a Gemini call and saves the result. Failed calls use no allowance and are
//                                     refunded by the per-IP limiter too.
//                                     403 = not enough trades yet, 429 = cap reached / mentor busy,
//                                     400 = bad range, no strategy or no trades.
// GET  /carry-forward                 the one change the latest saved review (weekly or range) asked the trader to carry
//                                     into the next plan: { commitment: { start, end, rule, planLine, checkpoint, source } | null }.
//                                     Read by the planner and the journal so feedback reaches the next plan. Never calls Gemini.
// GET  /:reviewId                     one saved range review, for opening it from the history.
const router = Router({ mergeParams: true });

router.get("/", verifyJWT, listAiReviewHistory);
router.get("/preview", verifyJWT, previewRangeReview);
router.get("/carry-forward", verifyJWT, getCarryForward); // before "/:reviewId" so it is not read as an id
router.post("/", verifyJWT, createRangeReview);
router.get("/:reviewId", verifyJWT, getRangeReviewById);

export { router as aiRangeReviewRouter };
