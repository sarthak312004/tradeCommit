import { Router } from "express";
import {
  createTrade,
  deleteTrade,
  getTradesByJournal,
  uploadTradeImage,
  updateTrade,
} from "../controllers/trade.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router({ mergeParams: true });

router.get("/", verifyJWT, getTradesByJournal);
router.post("/images", verifyJWT, upload.single("image"), uploadTradeImage);
router.post("/", verifyJWT, createTrade);
router.patch("/:tradeId", verifyJWT, updateTrade);
router.delete("/:tradeId", verifyJWT, deleteTrade);

export { router as tradeRouter };