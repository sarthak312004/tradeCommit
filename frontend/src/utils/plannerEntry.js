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
