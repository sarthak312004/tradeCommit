import { DEFAULT_PLANNER_TYPE } from './plannerTypes.js'

export const normalizePlanner = (planner) => ({
  id: planner.id ?? planner._id,
  name: planner.name ?? 'Untitled planner',
  type: planner.type ?? DEFAULT_PLANNER_TYPE,
  // the journal this planner is connected to (so the AI mentor can compare plans with executed trades), or null
  linkedJournalId: planner.linkedJournalId ?? null,
  readOnly: planner.readOnly === true,
  createdAt: planner.createdAt,
  updatedAt: planner.updatedAt
})

export const normalizeEntry = (entry) => ({
  id: entry.id ?? entry._id,
  plannerId: entry.plannerId,
  date: entry.date ?? '',
  scope: entry.scope ?? 'day',
  title: entry.title ?? '',
  content: entry.content ?? '',
  images: Array.isArray(entry.images) ? entry.images : [],
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt
})
