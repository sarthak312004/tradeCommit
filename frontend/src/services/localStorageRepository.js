const STORAGE_KEY = 'tradecommit.journals.v1'

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const now = () => new Date().toISOString()

const normalizeTrade = (trade, journalId) => ({
  ...trade,
  id: trade.id ?? createId(),
  journalId: trade.journalId ?? journalId,
  quantity: trade.quantity ?? trade.qty ?? '',
  qty: trade.qty ?? trade.quantity ?? '',
  direction: trade.direction ?? trade.side ?? 'Long',
  side: trade.side ?? trade.direction ?? 'Long',
  analysis: trade.analysis ?? '',
  images: Array.isArray(trade.images) ? trade.images : [],
  createdAt: trade.createdAt ?? now(),
  updatedAt: trade.updatedAt ?? now()
})

const normalizeJournal = (journal) => ({
  ...journal,
  id: journal.id ?? createId(),
  name: journal.name ?? 'Untitled journal',
  updated: journal.updated ?? 'Just now',
  createdAt: journal.createdAt ?? now(),
  updatedAt: journal.updatedAt ?? now(),
  trades: (journal.trades ?? []).map((trade) => normalizeTrade(trade, journal.id))
})

const read = () => {
  if (typeof window === 'undefined') return []

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY)
    return storedValue ? JSON.parse(storedValue).map(normalizeJournal) : []
  } catch {
    return []
  }
}

const write = (journals) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(journals))
  }
  return journals
}

export const journalRepository = {
  list() {
    return read()
  },

  create(name) {
    const timestamp = now()
    const journal = normalizeJournal({
      id: createId(),
      name,
      updated: 'Just now',
      createdAt: timestamp,
      updatedAt: timestamp,
      trades: []
    })
    return write([...read(), journal])
  },

  update(id, name) {
    const timestamp = now()
    return write(read().map((journal) => (
      journal.id === id
        ? {...journal, name, updated: 'Just now', updatedAt: timestamp}
        : journal
    )))
  },

  remove(id) {
    return write(read().filter((journal) => journal.id !== id))
  },

  addTrade(journalId, trade) {
    const timestamp = now()
    return write(read().map((journal) => (
      journal.id === journalId
        ? {...journal, trades: [...journal.trades, normalizeTrade(trade, journalId)], updated: 'Just now', updatedAt: timestamp}
        : journal
    )))
  },

  updateTrade(journalId, tradeId, updatedTrade) {
    const timestamp = now()
    return write(read().map((journal) => (
      journal.id === journalId
        ? {
            ...journal,
            trades: journal.trades.map((trade) => (
              trade.id === tradeId ? {...trade, ...updatedTrade, updatedAt: timestamp} : trade
            )),
            updated: 'Just now',
            updatedAt: timestamp
          }
        : journal
    )))
  },

  removeTrade(journalId, tradeId) {
    const timestamp = now()
    return write(read().map((journal) => (
      journal.id === journalId
        ? {
            ...journal,
            trades: journal.trades.filter((trade) => trade.id !== tradeId),
            updated: 'Just now',
            updatedAt: timestamp
          }
        : journal
    )))
  }
}
