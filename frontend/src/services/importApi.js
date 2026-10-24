import { readJson } from '../utils/http'

export const IMPORT_EXTENSIONS = ['.csv', '.xlsx']
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024
export const MAX_IMPORT_BATCH_SIZE = 1000

export const importTemplateUrl = (format) => `/api/v1/imports/template?format=${format}`

/**
 * Sends a CSV / XLSX file to the server for reading. Nothing is saved: the answer is the list of trades found
 * ({ fileName, format, trades, skipped, skippedCount, warnings, totalRows, truncated }) for the review step.
 */
export const previewTradeImport = async (file, mapping = null) => {
  const body = new FormData()
  body.append('file', file)
  if (mapping) body.append('mapping', JSON.stringify(mapping))
  const response = await fetch('/api/v1/imports/preview', { method: 'POST', credentials: 'include', body })
  return readJson(response)
}
