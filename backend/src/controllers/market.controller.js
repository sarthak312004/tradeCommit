import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cleanSymbol, getQuote, searchSymbols } from "../utils/marketData.js";
import { fetchMarketNews } from "../utils/marketNews.js";

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

// GET /api/v1/market/news?region=GLOBAL|IN|US
export const getMarketNews = asyncHandler(async (req, res) => {
  const region = String(req.query.region ?? "GLOBAL").toUpperCase();
  if (!["GLOBAL", "IN", "US"].includes(region)) throw new ApiError(400, "Choose a supported market region");

  let items;
  try {
    items = await fetchMarketNews(region);
  } catch (error) {
    console.error("Could not fetch market research headlines:", error);
    throw new ApiError(502, "Market headlines are temporarily unavailable. Please try again.");
  }

  return res.status(200).json(new ApiResponse(200, { region, items, fetchedAt: new Date().toISOString() }, "Market headlines fetched"));
});
