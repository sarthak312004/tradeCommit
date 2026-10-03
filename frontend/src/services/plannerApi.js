import { readJson, requestJson } from '../utils/http'
import { DEFAULT_PLANNER_TYPE } from '../utils/plannerTypes'

const API_BASE = '/api/v1/planners'

export const normalizePlanner = (planner) => ({
  id: planner.id ?? planner._id,
  name: planner.name ?? 'Untitled planner',
  type: planner.type ?? DEFAULT_PLANNER_TYPE,
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

  async create({ name, type }) {
    return normalizePlanner(await requestJson(API_BASE, { method: 'POST', body: { name, type } }))
  },

  async update(plannerId, changes) {
    return normalizePlanner(await requestJson(`${API_BASE}/${plannerId}`, { method: 'PATCH', body: changes }))
  },

  async remove(plannerId) {
    await requestJson(`${API_BASE}/${plannerId}`, { method: 'DELETE' })
  },

  async listEntries(plannerId) {
    return (await requestJson(`${API_BASE}/${plannerId}/entries`) ?? []).map(normalizeEntry)
  },

  async createEntry(plannerId, entry) {
    return normalizeEntry(await requestJson(`${API_BASE}/${plannerId}/entries`, { method: 'POST', body: entry }))
  },

  async updateEntry(plannerId, entryId, entry) {
    return normalizeEntry(await requestJson(`${API_BASE}/${plannerId}/entries/${entryId}`, { method: 'PATCH', body: entry }))
  },

  async removeEntry(plannerId, entryId) {
    await requestJson(`${API_BASE}/${plannerId}/entries/${entryId}`, { method: 'DELETE' })
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
