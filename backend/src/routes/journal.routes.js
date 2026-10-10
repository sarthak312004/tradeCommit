import { Router } from "express";
import {
  createJournal,
  deleteJournal,
  getAllJournals,
  updateJournal,
} from "../controllers/journal.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { rateLimit } from "../middlewares/rateLimit.middleware.js";
import { exportJournal } from "../controllers/export.controller.js";

const router = Router();

// exports build whole files in memory, so keep them to a sensible rate per IP
const exportLimiter = rateLimit({ windowMs: 60 * 1000, max: 15, message: "Too many exports, please wait a minute and try again" });

router.get("/", verifyJWT, getAllJournals);
router.post("/", verifyJWT, createJournal);
router.get("/:journalId/export", verifyJWT, exportLimiter, exportJournal);
router.patch("/:journalId", verifyJWT, updateJournal);
router.delete("/:journalId", verifyJWT, deleteJournal);

export { router as journalRouter };