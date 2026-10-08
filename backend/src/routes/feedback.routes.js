import { Router } from "express";
import {
  dismissFeedbackPrompt,
  getFeedbackStatus,
  submitBugReport,
  submitFeedback,
} from "../controllers/feedback.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router.get("/status", getFeedbackStatus);
router.post("/dismiss", dismissFeedbackPrompt);
router.post("/bug", submitBugReport);
router.post("/", submitFeedback);

export { router as feedbackRouter };