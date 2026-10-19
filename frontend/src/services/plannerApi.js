import { readJson, requestJson } from '../utils/http'
import { DEFAULT_PLANNER_TYPE } from '../utils/plannerTypes'

const API_BASE = '/api/v1/planners'
const entriesCache = new Map()
const entriesRequests = new Map()

const updateCachedEntries = (plannerId, update) => {
  const current = entriesCache.get(plannerId)
  if (current) entriesCache.set(plannerId, update(current))
}

export const normalizePlanner = (planner) => ({
  id: planner.id ?? planner._id,
  name: planner.name ?? 'Untitled planner',
  type: planner.type ?? DEFAULT_PLANNER_TYPE,
  // the journal this planner is connected to (so the AI mentor can compare plans with executed trades), or null
  linkedJournalId: planner.linkedJournalId ?? null,
  createdAt: planner.createdAt,
  updatedAt: planner.updatedAt
})

export const normalizeEntry = (entry) => ({
  id: entry.id ?? entry._id,
  plannerId: entry.plannerId,
  date: entry.date ?? '',
  title: entry.title ?? '',
  content: entry.content ?? '',
  images: Array.isArray(entry.images) ? entry.images : [],
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt
})

export const plannerApi = {
  async list() {
    return (await requestJson(API_BASE) ?? []).map(normalizePlanner)
  },

  async create({ name, type, linkedJournalId }) {
    const body = linkedJournalId ? { name, type, linkedJournalId } : { name, type }
    return normalizePlanner(await requestJson(API_BASE, { method: 'POST', body }))
  },

  async update(plannerId, changes) {
    return normalizePlanner(await requestJson(`${API_BASE}/${plannerId}`, { method: 'PATCH', body: changes }))
  },

  async remove(plannerId) {
    await requestJson(`${API_BASE}/${plannerId}`, { method: 'DELETE' })
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
