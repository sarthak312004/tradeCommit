# Trade import (CSV / Excel) — patch notes

No new dependencies. Parsing runs on the server with `exceljs` (already in backend/package.json) and a small built-in CSV reader.

## Routes (all need login)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/imports/preview` | multipart, field `file` (.csv / .xlsx, max 5 MB). Reads up to 20,000 worksheet rows and returns all parsed trades + tags. **Saves nothing.** |
| POST | `/api/v1/imports/commit` | JSON `{ groups: [{ journalId, trades: [...] }] }`. Validates again, skips trades already in that journal, saves the rest. Max 1000 trades per call; the frontend sends larger selections in batches of 1000. |
| GET | `/api/v1/imports/template?format=csv\|xlsx` | Sample file in the layout the importer reads best. |

Rate limits: preview 20/min, commit 30/min per IP.

## New files

```
backend/src/utils/tradeImport.js            reader, column detection, FIFO pairing, tagging, validation
backend/src/utils/tradeImport.test.js       9 tests (run with: npm test)
backend/src/controllers/import.controller.js
backend/src/routes/import.routes.js
frontend/src/services/importApi.js
frontend/src/components/rightContainer/journal/import/
    ImportTradesDialog.jsx  ImportDropzone.jsx  ImportReview.jsx
    ImportTradeRow.jsx      importStyles.js     importIcons.jsx
import-samples/   two files to try it with (a broker tradebook and a one-row-per-trade sheet)
```

## Existing files changed (small; merge by hand if your local copy differs)

**backend/src/app.js** — three edits
```js
// 1) replace:  app.use(express.json({limit:"16kb"}))
const jsonDefault = express.json({limit:"16kb"})
const jsonImport = express.json({limit:"12mb"})
app.use((req, res, next) => (req.path.startsWith('/api/v1/imports') ? jsonImport : jsonDefault)(req, res, next))
// 2) with the other router imports:
import { importRouter } from './routes/import.routes.js'
// 3) with the other app.use("/api/v1/...") lines:
app.use("/api/v1/imports", importRouter)
```
Only the import path gets the larger JSON limit; every other route keeps 16 kb.

**frontend/src/components/rightContainer/journal/JournalActionsMenu.jsx** — new `onImport` prop and an "Import trades" entry above Export.

**frontend/src/components/rightContainer/journal/TradeJournal.jsx** — props `journals`, `onImportTrades`, `onOpenJournal`; `isImportOpen` state; lazy `ImportTradesDialog`; `onImport` passed to the menu.

**frontend/src/pages/MainJournal.jsx** — reads `journals`, `selectJournal`, `importTrades` from the context and passes them down.

**frontend/src/context/journalContextProvider.jsx** — new `importTrades(groups)` (commit, then re-reads the affected journals' trades; trades still saving are kept) and exported in the provider value.

## How it behaves

- **File shapes.** (1) one row per trade: Date, Symbol, Direction, Quantity, Entry Price (+ optional Exit Price, Stop Loss, Exit Date, Product, Notes). TradeCommit's own export re-imports. (2) broker tradebook: one row per buy/sell fill (symbol, trade_date, trade_type, quantity, price...). Fills are paired first-in-first-out per symbol; scaled-in fills become one trade at the volume-weighted price; leftover quantity becomes an open trade.
- **Headers** are matched by name (many aliases), the header row can sit below title rows, dates may be 2025-01-06, 06-01-2025, 6-Jan-2025, Excel serials. Day-first is assumed unless the data proves month-first. If headings are unfamiliar, the user can choose from all scanned candidate rows or select **No header row** to map positional columns without dropping the first trade. The parsed trades are reviewed before saving.
- **Intraday / delivery tag** (shown on every row, click to cycle Intraday → Delivery → Unclassified; hover shows why):
  closed trade → same day = Intraday, otherwise Delivery; no exit date → Product column (MIS/intraday vs CNC/delivery); open trade from an earlier day → Delivery; anything else → Unclassified.
- **Saved as** a text property `Trade type` (Intraday / Delivery) on the trade, plus an `Exit date` property for trades that closed on a later day. If the journal already has a default property with the same name, its key is reused. The journal's other default properties are applied like in the trade form.
- **Review step.** Filter by tag, tick trades, and choose one destination journal for the import. The review list shows 100 rows per page while retaining selection across pages; select all applies to the full filtered set.
- **Safe to repeat.** Trades already in the target journal (same asset, day, direction, entry, size) are skipped and reported, so importing the same file twice adds nothing.
- Imported trades count toward the 5-trade AI mentor unlock like any new trade (distinct trades only).
- No direction column → everything is treated as Long, and the review shows a notice.

## Checked here
- `npm test` style run: 23/23 backend tests pass (9 new).
- Both sample files parsed through the real code (output matches the expectations above).
- All new/changed frontend files parse as valid JSX and every relative import/export resolves.

## Not run here
- No dependencies are installed in my sandbox, so I could not start the server, bundle the frontend, or read a real `.xlsx` through `exceljs`. The Excel path uses standard exceljs calls (`workbook.xlsx.load`, `eachRow`, `getCell`) and shares everything after reading with the CSV path, which is tested. Please try one `.xlsx` and one CSV after deploying.
