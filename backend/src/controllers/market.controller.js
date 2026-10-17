import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cleanSymbol, getQuote, searchSymbols } from "../utils/marketData.js";

// `prefer=IN` (sent for INR journals) makes a bare ticker like TCS resolve to NSE/BSE before foreign exchanges
const preferenceOf = (query) => (String(query.prefer ?? "").toUpperCase() === "IN" ? "IN" : "GLOBAL");

// GET /api/v1/market/quote?symbol=RELIANCE&prefer=IN[&exact=1]
export const getLiveQuote = asyncHandler(async (req, res) => {
  const symbol = cleanSymbol(req.query.symbol);
  if (!symbol) throw new ApiError(400, "Enter a valid symbol");

  const quote = await getQuote(symbol, {
    prefer: preferenceOf(req.query),
    exact: req.query.exact === "1" || req.query.exact === "true",
  });
  return res.status(200).json(new ApiResponse(200, quote, "Live price fetched"));
});

// GET /api/v1/market/search?q=reli&prefer=IN
export const searchMarketSymbols = asyncHandler(async (req, res) => {
  const results = await searchSymbols(req.query.q, { prefer: preferenceOf(req.query) });
  return res.status(200).json(new ApiResponse(200, results, "Symbols fetched"));
});
