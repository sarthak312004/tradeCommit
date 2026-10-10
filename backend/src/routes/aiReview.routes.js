import { Router } from "express";
import { createAiReview, getAiReview } from "../controllers/aiReview.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

// mounted at /api/v1/journals/:journalId/ai-review
const router = Router({ mergeParams: true });

router.get("/", verifyJWT, getAiReview);
router.post("/", verifyJWT, createAiReview);

export { router as aiReviewRouter };
