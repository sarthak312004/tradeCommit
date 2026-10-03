import { Router } from "express";
import {
  createPlanEntry,
  createPlanner,
  deletePlanEntry,
  deletePlanner,
  getAllPlanners,
  getPlanEntries,
  updatePlanEntry,
  updatePlanner,
  uploadPlanImage,
} from "../controllers/planner.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.use(verifyJWT);

router.get("/", getAllPlanners);
router.post("/", createPlanner);
router.patch("/:plannerId", updatePlanner);
router.delete("/:plannerId", deletePlanner);

router.get("/:plannerId/entries", getPlanEntries);
router.post("/:plannerId/entries/images", upload.single("image"), uploadPlanImage);
router.post("/:plannerId/entries", createPlanEntry);
router.patch("/:plannerId/entries/:entryId", updatePlanEntry);
router.delete("/:plannerId/entries/:entryId", deletePlanEntry);

export { router as plannerRouter };
