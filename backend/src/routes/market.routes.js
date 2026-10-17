import { Router } from "express";
import { getLiveQuote, searchMarketSymbols } from "../controllers/market.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/quote", verifyJWT, getLiveQuote);
router.get("/search", verifyJWT, searchMarketSymbols);

export { router as marketRouter };
