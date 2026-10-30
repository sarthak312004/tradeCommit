# Agent Instructions — TradeCommit

This file is the entry point for coding agents. Read this file and `PROJECT_CONTEXT.md` before exploring source code.

## 1. Token-efficient workflow

1. Read `PROJECT_CONTEXT.md` to understand the architecture, data flow, middleware, database entities, and important conventions.
2. Identify the exact feature and trace only its path:
   - UI/page/component
   - frontend context, hook, or service
   - backend route
   - controller
   - model and relevant utility
3. Use targeted search (`rg`) and open only the files needed for the task. Do **not** recursively read the whole repository.
4. Before editing, inspect the existing implementation and its callers. Treat the source code as authoritative if this guide is stale.
5. Make the smallest safe change. Preserve existing behavior unless the task explicitly requests a behavior change.
6. Run the narrowest relevant tests/build/lint, then report exactly what was run and any failures.

## 2. Project safety rules

- This is an existing production application. Avoid broad refactors, dependency upgrades, schema redesigns, or unrelated UI changes.
- Do not change API response shapes, route paths, authentication behavior, persisted field names, or import/export formats without checking all consumers.
- Never trust client-supplied `owner`, `user`, or ownership identifiers. Derive the authenticated user from `req.user` and enforce ownership in database queries.
- Never expose passwords, password hashes, refresh tokens, OTP hashes, secrets, or private provider credentials in responses or logs.
- Do not commit `.env`, credentials, API keys, tokens, cookies, or real user data. Treat `backend/cookies.txt` and all environment/config files as potentially sensitive; do not inspect or reproduce secrets unless directly necessary.
- Do not edit generated output (`frontend/dist`), `node_modules`, lockfiles, or deployment configuration unless the task requires it.
- Preserve live-vs-backtest semantics. AI review logic must respect the journal's `mode`.
- Preserve journal currency semantics. A journal's currency is immutable in the current schema.
- Rich-text fields contain HTML. Follow existing sanitization utilities and do not render untrusted HTML unsafely.
- Image uploads use Cloudinary. Follow the existing Multer/controller/Cloudinary flow; do not store uploaded binaries in MongoDB.
- Keep frontend API calls consistent with `credentials: 'include'` and the existing cookie-based session flow.
- Prefer existing `ApiError`, `ApiResponse`, and `asyncHandler` utilities in backend controllers.
- Respect existing rate limits and AI quota/queue guards. Do not add a path that bypasses them.
- Imports can contain large batches. Preserve the dedicated larger JSON body limit and import preview/commit validation flow.

## 3. Repository map

- `frontend/` — React + Vite client. Application source is in `frontend/src/`.
- `backend/` — Express 5 + Mongoose API. Application source is in `backend/src/`.
- `backend/src/routes/` — route definitions and route-level middleware.
- `backend/src/controllers/` — request handlers and business workflows.
- `backend/src/models/` — Mongoose schemas and persistence.
- `backend/src/middlewares/` — authentication, uploads, and rate limiting.
- `backend/src/utils/` — shared backend helpers, AI prompts/quotas/queues, market data, exports, sanitization, and statistics.
- `frontend/src/pages/` — route-level screens.
- `frontend/src/components/` — UI components grouped by feature.
- `frontend/src/context/` — shared journal/planner state.
- `frontend/src/services/` — API client/service modules.
- `frontend/src/hooks/` — reusable client behavior.
- `frontend/src/utils/` — client-side formatting, analytics, import/export, and UI helpers.

## 4. Commands

Run commands from the relevant package directory:

```bash
# Backend
cd backend
npm test
npm run dev

# Frontend
cd frontend
npm run build
npm run lint
npm run dev
```

Backend `npm test` runs Node's test runner against `src/utils/*.test.js`. Frontend has Vite build and ESLint scripts; there is no frontend test script declared in the current package manifest.

## 5. Required completion report

At the end of a task, summarize:
- files changed and why
- behavior/API/schema changes, if any
- tests/build/lint actually run and their result
- known risks, migration needs, or manual verification still required

If source code contradicts this guide, follow the source and update this guide when the architecture has materially changed.
