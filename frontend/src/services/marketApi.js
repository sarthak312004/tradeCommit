import { readJson } from '../utils/http'

const BASE = '/api/v1/market'

const get = (path, params, signal) => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  return fetch(`${BASE}${path}?${query}`, { credentials: 'include', signal }).then(readJson)
}

/**
 * Live price of one instrument.
 * `prefer: 'IN'` makes a bare ticker (TCS) resolve to NSE/BSE first; `exact` means `symbol` is already a provider id.
 * Resolves to { symbol, display, price, currency, exchange, name, time, marketOpen, source }.
 */
export const fetchQuote = (symbol, { prefer, exact, signal } = {}) =>
  get('/quote', { symbol, prefer, exact: exact ? '1' : undefined }, signal)

/** Autocomplete: [{ symbol, display, name, exchange, type, exact }] */
export const searchSymbols = (query, { prefer, signal } = {}) => get('/search', { q: query, prefer }, signal)
