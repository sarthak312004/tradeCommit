// Live price lookup for the trade form. No API key needed:
//   - Yahoo Finance  -> Indian stocks (NSE .NS / BSE .BO), indices, US/global stocks, forex, metals, futures, crypto
//   - Binance public -> crypto pairs (real-time), with Yahoo as the fallback
//
// Everything is cached in memory (fine for a single instance, like the rate limiter) so the form can
// poll without hammering the providers.

import { ApiError } from "./ApiError.js";

const YAHOO_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
const BINANCE_HOSTS = ["data-api.binance.vision", "api.binance.com"];
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
};
const TIMEOUT_MS = 4500;

const QUOTE_TTL_MS = 8_000;
const MISS_TTL_MS = 60_000;
const RESOLVE_TTL_MS = 24 * 60 * 60 * 1000;
const SEARCH_TTL_MS = 5 * 60 * 1000;

/* ---------- tiny TTL cache + in-flight de-duplication ---------- */
const createCache = (limit = 500) => {
  const map = new Map();
  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) return undefined;
      if (entry.expires <= Date.now()) {
        map.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value, ttl) {
      if (map.size >= limit) map.delete(map.keys().next().value);
      map.set(key, { value, expires: Date.now() + ttl });
    },
  };
};

const quoteCache = createCache();
const missCache = createCache();
const resolvedCache = createCache(2000);
const searchCache = createCache(300);
const inflight = new Map();

const dedupe = (key, task) => {
  if (inflight.has(key)) return inflight.get(key);
  const promise = task().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
};

/* ---------- symbol knowledge ---------- */

// Names traders actually type that Yahoo doesn't know. `ids` are tried in order.
const ALIASES = [
  { keys: ["NIFTY", "NIFTY50"], ids: ["^NSEI"], name: "Nifty 50", exchange: "NSE", type: "INDEX" },
  { keys: ["BANKNIFTY", "NIFTYBANK"], ids: ["^NSEBANK"], name: "Nifty Bank", exchange: "NSE", type: "INDEX" },
  { keys: ["FINNIFTY", "NIFTYFINSERVICE"], ids: ["NIFTY_FIN_SERVICE.NS"], name: "Nifty Financial Services", exchange: "NSE", type: "INDEX" },
  { keys: ["NIFTYIT"], ids: ["^CNXIT"], name: "Nifty IT", exchange: "NSE", type: "INDEX" },
  { keys: ["SENSEX", "BSESENSEX"], ids: ["^BSESN"], name: "BSE Sensex", exchange: "BSE", type: "INDEX" },
  { keys: ["INDIAVIX"], ids: ["^INDIAVIX"], name: "India VIX", exchange: "NSE", type: "INDEX" },
  { keys: ["SPX", "SPX500", "SP500", "US500"], ids: ["^GSPC"], name: "S&P 500", exchange: "US", type: "INDEX" },
  { keys: ["US30", "DJI", "DOW", "DOWJONES"], ids: ["^DJI"], name: "Dow Jones Industrial Average", exchange: "US", type: "INDEX" },
  { keys: ["NAS100", "NDX", "US100", "NASDAQ100"], ids: ["^NDX"], name: "Nasdaq 100", exchange: "US", type: "INDEX" },
  { keys: ["NASDAQ", "IXIC"], ids: ["^IXIC"], name: "Nasdaq Composite", exchange: "US", type: "INDEX" },
  { keys: ["VIX"], ids: ["^VIX"], name: "CBOE Volatility Index", exchange: "US", type: "INDEX" },
  { keys: ["GER40", "DAX", "DE40"], ids: ["^GDAXI"], name: "DAX", exchange: "Germany", type: "INDEX" },
  { keys: ["UK100", "FTSE", "FTSE100"], ids: ["^FTSE"], name: "FTSE 100", exchange: "UK", type: "INDEX" },
  { keys: ["JP225", "NIKKEI", "NIKKEI225"], ids: ["^N225"], name: "Nikkei 225", exchange: "Japan", type: "INDEX" },
  { keys: ["HK50", "HSI"], ids: ["^HSI"], name: "Hang Seng", exchange: "Hong Kong", type: "INDEX" },
  { keys: ["DXY", "USDX"], ids: ["DX-Y.NYB"], name: "US Dollar Index", exchange: "ICE", type: "INDEX" },
  { keys: ["XAUUSD"], ids: ["XAUUSD=X", "GC=F"], name: "Gold / US Dollar", exchange: "Spot", type: "CURRENCY" },
  { keys: ["XAGUSD"], ids: ["XAGUSD=X", "SI=F"], name: "Silver / US Dollar", exchange: "Spot", type: "CURRENCY" },
  { keys: ["GOLD"], ids: ["GC=F"], name: "Gold futures", exchange: "COMEX", type: "FUTURE" },
  { keys: ["SILVER"], ids: ["SI=F"], name: "Silver futures", exchange: "COMEX", type: "FUTURE" },
  { keys: ["USOIL", "WTI", "CRUDEOIL", "XTIUSD"], ids: ["CL=F"], name: "Crude Oil WTI futures", exchange: "NYMEX", type: "FUTURE" },
  { keys: ["UKOIL", "BRENT", "XBRUSD"], ids: ["BZ=F"], name: "Brent Crude futures", exchange: "ICE", type: "FUTURE" },
  { keys: ["NATGAS", "NGAS", "NATURALGAS"], ids: ["NG=F"], name: "Natural Gas futures", exchange: "NYMEX", type: "FUTURE" },
  { keys: ["COPPER"], ids: ["HG=F"], name: "Copper futures", exchange: "COMEX", type: "FUTURE" },
];

const aliasByKey = new Map();
const aliasById = new Map();
for (const alias of ALIASES) {
  for (const key of alias.keys) aliasByKey.set(key, alias);
  if (!aliasById.has(alias.ids[0])) aliasById.set(alias.ids[0], alias);
}

const FX_CODES = new Set((
  "USD EUR GBP JPY AUD NZD CAD CHF INR SGD HKD CNY CNH AED ZAR SEK NOK DKK MXN BRL TRY KRW THB IDR MYR PHP PLN CZK HUF ILS SAR XAU XAG XPT XPD"
).split(" "));

const CRYPTO_BASES = new Set((
  "BTC ETH BNB SOL XRP ADA DOGE DOT AVAX MATIC POL LINK LTC TRX SHIB UNI ATOM XLM BCH NEAR APT ARB OP SUI PEPE TON ETC FIL INJ AAVE ALGO HBAR ICP VET RUNE MKR GRT FTM SAND MANA AXS THETA EOS XMR FLOW CRV LDO IMX SEI TIA WLD FET RNDR RENDER STX BONK WIF JUP ENA"
).split(" "));

const CRYPTO_QUOTES = ["USDT", "USDC", "FDUSD", "BUSD", "USD", "EUR", "INR", "BTC", "ETH"];
const STABLE_QUOTES = new Set(["USDT", "USDC", "FDUSD", "BUSD", "USD"]);
const SEARCH_TYPES = new Set(["EQUITY", "ETF", "INDEX", "CURRENCY", "CRYPTOCURRENCY", "FUTURE"]);

/** Uppercase, no spaces, "EUR/USD" -> "EURUSD". Returns "" when the text can't be a symbol. */
export const cleanSymbol = (value) => {
  const text = String(value ?? "").toUpperCase().replace(/[\s/]+/g, "");
  return /^[A-Z0-9.\-=^_&]{1,30}$/.test(text) ? text : "";
};

const aliasKeyOf = (text) => text.replace(/[^A-Z0-9]/g, "");

const splitForex = (symbol) => {
  const match = symbol.match(/^([A-Z]{3})([A-Z]{3})$/);
  return match && FX_CODES.has(match[1]) && FX_CODES.has(match[2]) && match[1] !== match[2] ? match : null;
};

const splitCrypto = (symbol) => {
  for (const quote of CRYPTO_QUOTES) {
    if (symbol.length > quote.length && symbol.endsWith(quote)) {
      const base = symbol.slice(0, -quote.length);
      if (CRYPTO_BASES.has(base)) return { base, quote };
    }
  }
  return null;
};

/** What the journal shows for a Yahoo id: RELIANCE.NS -> RELIANCE, EURUSD=X -> EURUSD, BTC-USD -> BTCUSD. */
export const toDisplay = (yahooId) => {
  const alias = aliasById.get(yahooId);
  if (alias) return alias.keys[0];
  return yahooId.replace(/\.NS$/, "").replace(/=[XF]$/, "").replace(/^\^/, "").replace(/-/g, "");
};

/* ---------- HTTP ---------- */
class UpstreamError extends Error {}

// null = the provider says "no such symbol"; UpstreamError = provider unreachable / rate limited
const getJson = async (url) => {
  let response;
  try {
    response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new UpstreamError("unreachable");
  }
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new UpstreamError(`status ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new UpstreamError("bad response");
  }
};

// try each mirror host in turn; a clean "not found" stops immediately
const fromHosts = async (hosts, buildUrl) => {
  let lastError = null;
  for (const host of hosts) {
    try {
      return await getJson(buildUrl(host));
    } catch (error) {
      if (!(error instanceof UpstreamError)) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new UpstreamError("unreachable");
};

const roundPrice = (price) => {
  const decimals = price >= 1000 ? 2 : price >= 100 ? 3 : price >= 10 ? 4 : price >= 1 ? 5 : 8;
  return Number(price.toFixed(decimals));
};

// A starting stop-loss distance for the form (it can be edited): a few tenths of a percent for forex,
// more room for crypto and futures, 1% for stocks and indices.
const stopDistanceFor = ({ symbol, source, price }) => {
  let percent = 0.01;
  if (source === "binance" || /^[A-Z0-9]+-[A-Z]{3,4}$/.test(symbol)) percent = 0.015;
  else if (/=X$/.test(symbol)) percent = 0.003;
  else if (/=F$/.test(symbol)) percent = 0.007;
  return roundPrice(price * percent);
};

/* ---------- providers ---------- */
const yahooQuote = async (id, display = toDisplay(id)) => {
  const data = await fromHosts(
    YAHOO_HOSTS,
    (host) => `https://${host}/v8/finance/chart/${encodeURIComponent(id)}?interval=1d&range=1d&includePrePost=false`,
  );
  const meta = data?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  if (!meta || !Number.isFinite(price) || price <= 0) return null;

  const regular = meta.currentTradingPeriod?.regular;
  const nowSeconds = Date.now() / 1000;
  return {
    symbol: id,
    display,
    price: roundPrice(price),
    currency: meta.currency ?? null,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
    name: meta.longName ?? meta.shortName ?? null,
    time: new Date((meta.regularMarketTime ?? nowSeconds) * 1000).toISOString(),
    marketOpen: regular ? nowSeconds >= regular.start && nowSeconds <= regular.end : null,
    source: "yahoo",
  };
};

const binanceQuote = async (pair, display) => {
  const data = await fromHosts(BINANCE_HOSTS, (host) => `https://${host}/api/v3/ticker/price?symbol=${encodeURIComponent(pair)}`);
  const price = Number(data?.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    symbol: pair,
    display,
    price: roundPrice(price),
    currency: pair.endsWith("USDT") ? "USDT" : null,
    exchange: "Binance",
    name: null,
    time: new Date().toISOString(),
    marketOpen: true, // crypto never closes
    source: "binance",
  };
};

const runCandidate = (candidate) =>
  candidate.provider === "binance" ? binanceQuote(candidate.id, candidate.display) : yahooQuote(candidate.id, candidate.display);

/* ---------- symbol -> provider candidates ---------- */

// `parallel` = unrelated guesses (RELIANCE.NS / .BO / plain), best match wins by order.
// Otherwise the candidates are fallbacks of each other and are tried one after another.
const buildPlan = (symbol, prefer) => {
  const alias = aliasByKey.get(aliasKeyOf(symbol));
  if (alias) return { parallel: false, candidates: alias.ids.map((id) => ({ provider: "yahoo", id, display: alias.keys[0] })) };

  // already Yahoo syntax: RELIANCE.NS, EURUSD=X, BTC-USD, ^NSEI, M&M.NS
  if (/[.\-=^]/.test(symbol)) return { parallel: false, candidates: [{ provider: "yahoo", id: symbol, display: toDisplay(symbol) }] };

  const forex = splitForex(symbol);
  if (forex) return { parallel: false, candidates: [{ provider: "yahoo", id: `${symbol}=X`, display: symbol }] };

  const crypto = splitCrypto(symbol);
  if (crypto) {
    const binancePair = `${crypto.base}${crypto.quote === "USD" ? "USDT" : crypto.quote}`;
    const yahooId = `${crypto.base}-${STABLE_QUOTES.has(crypto.quote) ? "USD" : crypto.quote}`;
    return {
      parallel: false,
      candidates: [
        { provider: "binance", id: binancePair, display: symbol },
        { provider: "yahoo", id: yahooId, display: symbol },
      ],
    };
  }

  const suffixes = prefer === "IN" ? [".NS", ".BO", ""] : ["", ".NS", ".BO"];
  return { parallel: true, candidates: suffixes.map((suffix) => ({ provider: "yahoo", id: `${symbol}${suffix}`, display: toDisplay(`${symbol}${suffix}`) })) };
};

const settle = async (plan) => {
  let unavailable = false;

  if (plan.parallel) {
    const results = await Promise.allSettled(plan.candidates.map(runCandidate));
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (result.status === "fulfilled" && result.value) return { quote: result.value, candidate: plan.candidates[index], unavailable };
      if (result.status === "rejected") unavailable = true;
    }
    return { quote: null, candidate: null, unavailable };
  }

  for (const candidate of plan.candidates) {
    try {
      const quote = await runCandidate(candidate);
      if (quote) return { quote, candidate, unavailable };
    } catch (error) {
      if (!(error instanceof UpstreamError)) throw error;
      unavailable = true;
    }
  }
  return { quote: null, candidate: null, unavailable };
};

// only trust a search hit that actually resembles what was typed, never silently price an unrelated stock
const looksLikeMatch = (symbol, hit) =>
  hit.display.startsWith(symbol) || aliasKeyOf(hit.name.toUpperCase()).includes(aliasKeyOf(symbol));

/* ---------- public: quote ---------- */
export const getQuote = async (rawSymbol, { prefer = "GLOBAL", exact = false } = {}) => {
  const symbol = cleanSymbol(rawSymbol);
  if (!symbol) throw new ApiError(400, "Enter a valid symbol");

  const cacheKey = `${exact ? "x" : "r"}|${prefer}|${symbol}`;
  const cached = quoteCache.get(cacheKey);
  if (cached) return cached;
  if (missCache.get(cacheKey)) throw new ApiError(404, `No live price found for ${symbol}`);

  return dedupe(cacheKey, async () => {
    let result = { quote: null, candidate: null, unavailable: false };

    // the provider that answered last time for this symbol: one request instead of a few
    const remembered = resolvedCache.get(cacheKey);
    if (remembered) {
      try {
        const quote = await runCandidate(remembered);
        if (quote) result = { quote, candidate: remembered, unavailable: false };
      } catch (error) {
        if (!(error instanceof UpstreamError)) throw error;
      }
    }

    if (!result.quote) {
      const plan = exact
        ? { parallel: false, candidates: [{ provider: "yahoo", id: symbol, display: toDisplay(symbol) }] }
        : buildPlan(symbol, prefer);
      result = await settle(plan);

      // "RELIANCE INDUSTRIES", typos, odd tickers: let Yahoo's own search pick the instrument
      if (!result.quote && !result.unavailable && !exact) {
        const hits = await yahooSearch(symbol).catch(() => []);
        const top = hits.find((hit) => looksLikeMatch(symbol, hit));
        if (top) {
          const quote = await yahooQuote(top.symbol, top.display).catch(() => null);
          if (quote) result = { quote, candidate: { provider: "yahoo", id: top.symbol, display: top.display }, unavailable: false };
        }
      }
    }

    if (!result.quote) {
      if (result.unavailable) throw new ApiError(502, "Live prices are temporarily unavailable. Enter the price manually.");
      missCache.set(cacheKey, true, MISS_TTL_MS);
      throw new ApiError(404, `No live price found for ${symbol}`);
    }

    result.quote.stopDistance = stopDistanceFor(result.quote);
    quoteCache.set(cacheKey, result.quote, QUOTE_TTL_MS);
    resolvedCache.set(cacheKey, result.candidate, RESOLVE_TTL_MS);
    return result.quote;
  });
};

/* ---------- public: search / autocomplete ---------- */
async function yahooSearch(query) {
  const data = await fromHosts(
    YAHOO_HOSTS,
    (host) => `https://${host}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0&listsCount=0`,
  );
  return (data?.quotes ?? [])
    .filter((item) => item?.symbol && SEARCH_TYPES.has(item.quoteType))
    .map((item) => ({
      symbol: item.symbol,
      display: toDisplay(item.symbol),
      name: item.longname ?? item.shortname ?? "",
      exchange: item.exchDisp ?? item.exchange ?? "",
      type: item.quoteType,
      exact: true, // already a Yahoo id, so no guessing needed when pricing it
    }));
}

const currencyName = (code) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
};

// suggestions that need no network: Indian/global indices, metals, oil, forex pairs, crypto pairs
const localMatches = (query) => {
  const key = aliasKeyOf(query.toUpperCase());
  if (!key) return [];
  const lowered = query.toLowerCase();
  const found = [];

  for (const alias of ALIASES) {
    if (alias.keys.some((name) => name.startsWith(key)) || alias.name.toLowerCase().includes(lowered)) {
      found.push({ symbol: alias.keys[0], display: alias.keys[0], name: alias.name, exchange: alias.exchange, type: alias.type, exact: false });
    }
  }

  const forex = splitForex(key);
  if (forex && !aliasByKey.has(key)) {
    found.push({ symbol: key, display: key, name: `${currencyName(forex[1])} / ${currencyName(forex[2])}`, exchange: "Forex", type: "CURRENCY", exact: false });
  }

  const crypto = splitCrypto(key);
  if (crypto) {
    found.push({ symbol: key, display: key, name: `${crypto.base} / ${crypto.quote}`, exchange: "Crypto", type: "CRYPTOCURRENCY", exact: false });
  }
  return found;
};

export const searchSymbols = async (rawQuery, { prefer = "GLOBAL" } = {}) => {
  const query = String(rawQuery ?? "").trim().slice(0, 40);
  if (query.length < 2) return [];

  const cacheKey = `${prefer}|${query.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  const local = localMatches(query);
  const remote = await dedupe(`search|${cacheKey}`, () => yahooSearch(query)).catch(() => []);

  const seen = new Set();
  const merged = [...local, ...remote].filter((item) => {
    const id = `${item.display}|${item.exchange}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  if (prefer === "IN") {
    const rank = (item) => (item.symbol.endsWith(".NS") ? 0 : item.symbol.endsWith(".BO") ? 1 : 2);
    merged.sort((a, b) => rank(a) - rank(b)); // Array.sort is stable, so Yahoo's relevance order is kept inside each group
  }

  const results = merged.slice(0, 8);
  // don't cache an empty list that may only mean Yahoo was unreachable
  if (results.length > 0) searchCache.set(cacheKey, results, SEARCH_TTL_MS);
  return results;
};
