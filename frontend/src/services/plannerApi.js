import { readJson, requestJson } from '../utils/http'
import { normalizeEntry, normalizePlanner } from '../utils/plannerEntry'
import { refreshProfile } from './profileApi'

export { normalizePlanner }

const API_BASE = '/api/v1/planners'
const entriesCache = new Map()
const entriesRequests = new Map()

const updateCachedEntries = (plannerId, update) => {
  const current = entriesCache.get(plannerId)
  if (current) entriesCache.set(plannerId, update(current))
}

export const plannerApi = {
  async list() {
    return (await requestJson(API_BASE) ?? []).map(normalizePlanner)
  },

  async create({ name, type, linkedJournalId }) {
    const body = linkedJournalId ? { name, type, linkedJournalId } : { name, type }
    const planner = normalizePlanner(await requestJson(API_BASE, { method: 'POST', body }))
    refreshProfile()
    return planner
  },

  async update(plannerId, changes) {
    const planner = normalizePlanner(await requestJson(`${API_BASE}/${plannerId}`, { method: 'PATCH', body: changes }))
    refreshProfile()
    return planner
  },

  async remove(plannerId) {
    await requestJson(`${API_BASE}/${plannerId}`, { method: 'DELETE' })
    refreshProfile()
  },

  async listEntries(plannerId) {
    if (entriesCache.has(plannerId)) return entriesCache.get(plannerId)
    if (entriesRequests.has(plannerId)) return entriesRequests.get(plannerId)

    const request = requestJson(`${API_BASE}/${plannerId}/entries`)
      .then((rows) => {
        const entries = (rows ?? []).map(normalizeEntry)
        entriesCache.set(plannerId, entries)
        return entries
      })
      .finally(() => entriesRequests.delete(plannerId))
    entriesRequests.set(plannerId, request)
    return request
  },

  async createEntry(plannerId, entry) {
    const created = normalizeEntry(await requestJson(`${API_BASE}/${plannerId}/entries`, { method: 'POST', body: entry }))
    updateCachedEntries(plannerId, (entries) => [...entries, created])
    refreshProfile()
    return created
  },

  async updateEntry(plannerId, entryId, entry) {
    const updated = normalizeEntry(await requestJson(`${API_BASE}/${plannerId}/entries/${entryId}`, { method: 'PATCH', body: entry }))
    updateCachedEntries(plannerId, (entries) => entries.map((item) => item.id === entryId ? updated : item))
    return updated
  },

  async removeEntry(plannerId, entryId) {
    await requestJson(`${API_BASE}/${plannerId}/entries/${entryId}`, { method: 'DELETE' })
    updateCachedEntries(plannerId, (entries) => entries.filter((item) => item.id !== entryId))
    refreshProfile()
  },

  async uploadImage(plannerId, file) {
    const formData = new FormData()
    formData.append('image', file)
    const response = await fetch(`${API_BASE}/${plannerId}/entries/images`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    })
    return (await readJson(response)).url
  }
}
