import { readJson } from '../utils/http'

const baseUrl = (journalId) => `/api/v1/journals/${journalId}/auto-log`

export const BROKER_CATALOG = [
  { id: 'zerodha', name: 'Zerodha Kite' },
  { id: 'dhan', name: 'Dhan' },
  { id: 'upstox', name: 'Upstox' },
  { id: 'angelone', name: 'Angel One' },
  { id: 'fyers', name: 'Fyers' },
  { id: 'tradingview', name: 'TradingView' },
  { id: 'mt5', name: 'MetaTrader 4 / 5' },
  { id: 'ctrader', name: 'cTrader' },
  { id: 'binance', name: 'Binance / Crypto' },
  { id: 'ibkr', name: 'Interactive Brokers' },
  { id: 'custom', name: 'Custom JSON webhook' }
]

export const WEBHOOK_JSON_EXAMPLE = `{
  "symbol": "AAPL",
  "action": "BUY",
  "quantity": 1,
  "price": 100,
  "status": "FILLED",
  "trade_id": "unique-execution-id",
  "time": "2026-11-06T14:30:00Z"
}`

export const autoLogApi = {
  getConfig: async (journalId) =>
    readJson(await fetch(baseUrl(journalId), { credentials: 'include' })),

  saveConfig: async (journalId, payload) =>
    readJson(
      await fetch(baseUrl(journalId), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    ),

  rotateToken: async (journalId) =>
    readJson(
      await fetch(`${baseUrl(journalId)}/rotate-token`, {
        method: 'POST',
        credentials: 'include'
      })
    )
}
