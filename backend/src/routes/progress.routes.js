import { Router } from "express";
import { celebrateMentorUnlock, getMentorUnlockProgress } from "../controllers/progress.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

// mounted at /api/v1/progress
//
// GET  /mentor              { count, target, completed, celebrated, badge, completedAt }: how many distinct trades the
//                           trader has logged towards unlocking AI feedback. Editing, duplicating, or deleting and
//                           re-adding a trade never adds a point. Never calls Gemini.
// POST /mentor/celebrated   marks the "your feedback is here" moment as seen (idempotent).
const router = Router();

router.get("/mentor", verifyJWT, getMentorUnlockProgress);
router.post("/mentor/celebrated", verifyJWT, celebrateMentorUnlock);

export { router as progressRouter };
