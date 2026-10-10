import { readJson } from '../utils/http'

export const EXPORT_FORMATS = [
  { id: 'xlsx', label: 'Excel', ext: '.xlsx', hint: 'Trades and summary sheets' },
  { id: 'csv', label: 'CSV', ext: '.csv', hint: 'Plain table, opens anywhere' },
  { id: 'pdf', label: 'PDF', ext: '.pdf', hint: 'Printable report' },
  { id: 'json', label: 'JSON', ext: '.json', hint: 'Full data incl. context' },
  { id: 'zip', label: 'ZIP bundle', ext: '.zip', hint: 'All four formats in one file' }
]

const fileNameFrom = (response, fallback) => {
  const header = response.headers.get('Content-Disposition') ?? ''
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1])
    } catch {
      // fall through to the plain name
    }
  }
  return header.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback
}

/**
 * Downloads a journal export. `preset` is the range id ('7d', '1m', '3m', '6m', '1y', '2y', 'all', 'custom');
 * `from` / `to` are the resolved local dates (empty = no limit). The browser saves the file itself.
 */
export const downloadJournalExport = async (journalId, { format, preset, from, to }) => {
  const params = new URLSearchParams({ format, range: preset })
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const response = await fetch(`/api/v1/journals/${journalId}/export?${params}`, { credentials: 'include' })
  if (!response.ok) await readJson(response) // throws with the server's message (and signals an expired session)

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileNameFrom(response, `journal-export.${format}`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
