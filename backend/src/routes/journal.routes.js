import { Router } from "express";
import {
  createJournal,
  deleteJournal,
  getAllJournals,
  updateJournal,
} from "../controllers/journal.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", verifyJWT, getAllJournals);
router.post("/", verifyJWT, createJournal);
router.patch("/:journalId", verifyJWT, updateJournal);
router.delete("/:journalId", verifyJWT, deleteJournal);

export { router as journalRouter };