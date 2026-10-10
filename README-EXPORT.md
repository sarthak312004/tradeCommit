# Journal export: what's in this zip

Copy the folders over your project (same paths). Files marked **changed** replace your copies; the rest are new.

## Install (backend only, frontend needs nothing new)

    cd backend
    npm install @json2csv/plainjs archiver exceljs pdfkit

`backend/package.json` in this zip already lists them. Note: the old `json2csv` package is deprecated,
so this uses its maintained successor `@json2csv/plainjs` (same author, same Parser API).

## Backend

| File | |
|---|---|
| `src/routes/journal.routes.js` | **changed**: adds `GET /:journalId/export` (login required, 15 requests/min per IP) |
| `src/controllers/export.controller.js` | new: validates, loads the journal's trades for the range, sends the file |
| `src/utils/exportRange.js` | new: presets + custom dates -> from/to |
| `src/utils/exportData.js` | new: rows, columns, P&L, R multiple, summary (shared by every format) |
| `src/utils/exporters.js` | new: CSV (json2csv), Excel (exceljs), PDF (pdfkit), JSON, ZIP (archiver) |
| `package.json` | **changed**: 4 new dependencies |

No change to `app.js`: the route lives under the existing `/api/v1/journals` router.

### Endpoint

    GET /api/v1/journals/:journalId/export?format=xlsx|csv|pdf|json|zip&range=7d|1m|3m|6m|1y|2y|all|custom&from=YYYY-MM-DD&to=YYYY-MM-DD

- `format` defaults to `xlsx`, `range` to `all`.
- `custom` needs `from` and/or `to`. If `from`/`to` are sent they win over the preset (the app sends both,
  resolved in the user's time zone).
- `zip` contains the Excel, CSV, JSON and PDF files.
- Only the signed-in owner's journal can be exported (404 otherwise).

## Frontend

| File | |
|---|---|
| `components/rightContainer/journal/TradeJournal.jsx` | **changed**: 3-dot menu next to "+ Add trade", opens the export dialog |
| `components/rightContainer/journal/JournalActionsMenu.jsx` | new: the 3-dot button + dropdown (add more actions to `items`) |
| `components/rightContainer/journal/ExportJournalDialog.jsx` | new: format + date range picker, live trade count, download |
| `components/rightContainer/journal/JournalContextDialog.jsx` | **changed**: one hint line (no resize corner any more) |
| `components/common/BasicRichTextEditor.jsx` | **changed**: context text area now looks like the TradeForm / PlanForm editor |
| `services/exportApi.js` | new: download call + format list |
| `utils/exportRange.js` | new: 7 days / month / 3m / 6m / 1y / 2y / all / custom |
| `utils/Icons.jsx` | **changed**: adds `MoreIcon` and `DownloadIcon` |

## Good to know

- PDF uses built-in fonts, so characters outside Latin-1 (e.g. Hindi, emoji) print as `?` in the PDF only.
  Amounts show the currency code (`INR 1,234.00`) for the same reason. Excel, CSV and JSON keep everything.
- The PDF lists screenshots as links and shortens analyses over 3,500 characters; the other formats keep full text.
- Exports are capped at 20,000 trades per file.
- Trades still saving (or failed) aren't on the server yet, so they are not counted or exported.
