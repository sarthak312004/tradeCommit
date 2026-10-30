# TradeCommit — Project Context for AI Agents

> Purpose: a compact architecture map so agents can locate the relevant code without scanning the repository. This is a guide, not a replacement for reading the specific implementation being changed. Source code is authoritative.

## 1. Product and stack

TradeCommit is a trading journal and planning application. Users create journals, record live or backtested trades, define journal strategy/context, create planners and dated plan entries, review trading activity, and use AI mentor reviews. It also includes market quote/search, import/export, feedback, onboarding, profile preferences, and image uploads.

| Layer | Current implementation |
|---|---|
| Frontend | React 19, Vite 8, React Router 8, Tailwind CSS 4, Tiptap, React Hook Form |
| Backend | Node.js ES modules, Express 5 |
| Database | MongoDB via Mongoose |
| Authentication | JWT access + refresh tokens in HTTP-only cookies; bearer access token is also accepted by auth middleware |
| AI | Gemini integration, guarded by quota/queue utilities |
| Images | Multer receives files; Cloudinary stores images; MongoDB stores image URLs |
| Analytics | Vercel Analytics on frontend |

There is no TypeScript in the current application source; the client is primarily `.jsx`/`.js`, backend `.js`.

## 2. High-level repository structure

```text
TradeCommit/
├── AGENTS.md                    # Instructions for coding agents (read first)
├── PROJECT_CONTEXT.md           # This architecture/data-flow guide
├── frontend/
│   ├── src/
│   │   ├── main.jsx              # Router and global providers
│   │   ├── Home.jsx               # Authenticated application shell
│   │   ├── pages/                 # Auth, journal, planner, onboarding, market screens
│   │   ├── components/            # Feature UI: auth, journal, planner, sidebar, tour, etc.
│   │   ├── context/               # JournalContextProvider, PlannerContextProvider
│   │   ├── services/              # API calls / service adapters
│   │   ├── hooks/                 # Reusable stateful behavior
│   │   └── utils/                 # HTTP, normalization, dates, rich text, analytics, etc.
│   └── dist/                      # Generated Vite output; do not edit by hand
└── backend/
    └── src/
        ├── index.js               # Environment checks, DB connect, server lifecycle
        ├── app.js                 # Express setup, middleware, route mounts, error handler
        ├── db/                    # MongoDB connection
        ├── routes/                # URL → middleware → controller
        ├── controllers/           # Business logic / request handlers
        ├── middlewares/            # JWT auth, Multer, rate limiting
        ├── models/                # Mongoose schemas
        ├── constants/             # Shared backend constants
        └── utils/                 # API wrappers, AI, sanitization, market, export, etc.
```

### Important frontend entry points

- `frontend/src/main.jsx`: creates router and wraps the app with `JournalContextProvider` and `PlannerContextProvider`.
- `frontend/src/Home.jsx`: main application shell; inspect for shell-level navigation/layout/auth behavior.
- `frontend/src/pages/MainJournal.jsx`: main journal screen.
- `frontend/src/pages/PlannerPage.jsx` and `LazyPlannerPage.jsx`: planner screen/loading path.
- `frontend/src/pages/AuthPage.jsx`: authentication UI.
- `frontend/src/context/journalContextProvider.jsx`: loads and manages journal list and trade state, including optimistic/pending save handling.
- `frontend/src/context/plannerContextProvider.jsx`: loads and manages planner list.
- `frontend/src/services/`: focused API adapters, e.g. `plannerApi.js`, `aiReviewApi.js`, `importApi.js`, `profileApi.js`.
- `frontend/src/utils/http.js`: shared JSON request helpers; includes cookies and dispatches `auth-expired` on HTTP 401.

## 3. Backend request lifecycle

Typical authenticated JSON request:

```text
Browser UI
  → page/component or context/hook
  → frontend service (or fetch helper)
  → fetch('/api/v1/...', credentials: 'include')
  → Express middleware (body parser, cookie parser, route-specific limiter)
  → route-level verifyJWT
  → controller (usually asyncHandler)
  → ownership validation + Mongoose model query/write
  → ApiResponse(data, message)
  → frontend readJson() unwraps response.data
  → context/component updates rendered UI
```

### Backend bootstrap

1. `backend/src/index.js` loads dotenv and validates required environment variables.
2. It connects to MongoDB via `dbConnection()`.
3. It starts the Express app and handles SIGTERM/SIGINT shutdown.
4. `backend/src/app.js` configures Express, global parsing/cookies, health endpoint, rate limits, API mounts, static frontend serving (when `frontend/dist/index.html` exists), 404 handling, and the final error handler.

### Response conventions

- Successful controllers generally return `new ApiResponse(statusCode, data, message)`.
- Expected errors are thrown as `new ApiError(statusCode, message)` and passed through `asyncHandler`.
- `app.js` final error middleware serializes failures as `{ statusCode, success: false, message, errors }`.
- Frontend `readJson()` expects JSON and returns `payload.data`; it throws on non-2xx and dispatches `auth-expired` on 401.
- Some contexts contain local response parsing/normalization; check the specific call path before changing shared behavior.

## 4. Express route map

These are the route mounts in `backend/src/app.js`. Route handlers and auth requirements are defined in the matching route file.

| Mount path | Route module | Purpose |
|---|---|---|
| `/api/v1/auth` | `routes/user.routes.js` | Email-code signup (creates the account + session), login/OTP/Google auth, logout, profile (`GET`/`PATCH /profile`), onboarding, preferences, password set/reset |
| `/api/v1/journals` | `routes/journal.routes.js` | Journal CRUD and journal export |
| `/api/v1/journals/:journalId/trades` | `routes/trade.routes.js` | Trade CRUD and trade image upload |
| `/api/v1/journals/:journalId/ai-review` | `routes/aiReview.routes.js` | Weekly AI mentor review and quota |
| `/api/v1/journals/:journalId/ai-range-reviews` | `routes/aiRangeReview.routes.js` | Date-range AI review/history/preview/carry-forward |
| `/api/v1/planners` | `routes/planner.routes.js` | Planner CRUD and dated plan-entry CRUD/image upload |
| `/api/v1/feedback` | `routes/feedback.routes.js` | Feedback, bug reports, feedback prompt state |
| `/api/v1/market` | `routes/market.routes.js` | Market quote, symbol search, market news |
| `/api/v1/progress` | `routes/progress.routes.js` | AI mentor unlock progress |
| `/api/v1/imports` | `routes/import.routes.js` | Import template, preview, commit |

`backend/src/routes/market.controller.js` is a controller file located in the routes directory; the mounted router is `market.routes.js`.

### Authentication middleware

`backend/src/middlewares/auth.middleware.js` exports `verifyJWT`.

- Reads access token from `req.cookies.accessToken`, or `Authorization: Bearer ...`.
- Verifies the access token and loads the user, excluding password and refresh-token fields.
- Rejects sessions issued before `passwordChangedAt`.
- If access token is absent/expired, attempts refresh using `req.cookies.refreshToken`.
- On valid refresh, issues a fresh access/refresh cookie pair and sets `req.user`.
- Protected controllers should use `req.user._id` as the authenticated owner identity.
- Do not assume every endpoint is protected: auth routes deliberately include public signup/login/OTP/reset endpoints.

### Authentication flows

- **Signup is frictionless (two steps, no form):** `POST /auth/signup/send-otp {email}` emails a code (409 if a verified account already exists); `POST /auth/signup/verify-otp {email, otp}` consumes the code (single-use `findOneAndDelete` on the stored hash), creates the `User` if needed (unique email index makes concurrent signups safe; one account wins, the other request is rejected or, if the account already exists, logs into it), and returns the normal `sendSession` payload + cookies. Frontend then navigates to `/`; `Home.jsx` still redirects accounts with `onboardingCompleted === false` to `/onboarding` (trading-style question, not an account form). `POST /auth/register` and the signup proof token were removed.
- New accounts get `fullname` derived from the email prefix (`sarthak.kumar92@x.com` -> `Sarthak Kumar`, empty if nothing name-like), a generated unique username built from that name (`sarthak_kumar_<6 hex>`), no password, `emailVerified: true`. Nothing authenticates unless an emailed code was accepted.
- **Profile (`PATCH /auth/profile {fullname?, username?}`, `verifyJWT`)** is where the name and username are added/edited (username `^[a-z0-9_]{3,20}$`, unique, lowercased; name <= 80 chars). Only `req.user._id` is updated. The profile card edits each field in place (pencil per row). The client keeps tour progress (localStorage, keyed by username) when the username changes.
- **Password is optional:** `GET /auth/profile` returns `hasPassword`. Setting (passwordless) or resetting (existing) a password uses the same logged-in email-code flow: `/auth/password/send-otp` -> `/verify-otp` -> `/reset`. Email-code login (`/auth/login/send-otp`, `/verify-otp`) works for every account regardless of password. Password login of a passwordless account returns the generic 401.

### Other middleware / request controls

- `middlewares/rateLimit.middleware.js`: custom rate limiter. `app.js` applies limits to auth, OTP, password, feedback, AI review, and market paths; route files add limits for export/import operations.
- `middlewares/multer.middleware.js`: upload middleware used for profile/header, planner, and trade image uploads.
- JSON body size: default 16 KB; `/api/v1/imports` receives a larger 12 MB JSON limit for batched import commits.
- Import uploads use in-memory Multer storage and a 5 MB file cap in `routes/import.routes.js`.
- CORS is credential-enabled and limited to `CORS_ORIGIN` when configured.
- Production enables Express `trust proxy`.

## 5. Database model map (MongoDB / Mongoose)

Model files live in `backend/src/models/`. This is a relationship-level summary; always inspect the schema before changing fields, validation, indexes, or deletion behavior.

```text
User
 ├── owns many Journal
 │    └── contains many Trade (Trade.journal → Journal)
 │         ├── customFields[]
 │         └── images[] (Cloudinary URLs)
 ├── owns many Planner
 │    └── contains many PlanEntry (PlanEntry.planner → Planner)
 ├── owns Feedback / BugReport
 ├── has MentorProgress (one per owner)
 └── associated with AI review/usage records

Journal
 ├── context.strategy
 ├── context.attributes[] (custom field defaults)
 ├── mode: live | backtest
 └── currency (ISO currency code; immutable after creation)

Planner
 ├── linkedJournal → optional Journal
 └── PlanEntry[] (dated content, images)

AI
 ├── AiReview (weekly saved review; unique journal + weekStart)
 ├── AiRangeReview (saved date-range review)
 ├── AiUsage (quota reservations/usage records with TTL)
 └── MentorProgress (distinct-trade unlock progress)
```

### Collections and key fields

| Model | File | Main data |
|---|---|---|
| `User` | `user.models.js` | username (unique; auto-generated at signup), email, fullname (optional, default `""`), password hash (optional: passwordless accounts have none), Google ID, email/onboarding flags, OTP/reset subdocuments, passwordChangedAt, headerBackdrop, focusPreferences (`focusTheme` + one saved Deep Mode playlist: `musicProvider` `spotify`/`youtube`, `spotifyUrl`, `youtubeUrl`), refreshToken |
| `Journal` | `journal.models.js` | journalName, description, mode (`live`/`backtest`), immutable currency, context strategy + custom attributes, owner |
| `Trade` | `trade.models.js` | date, assetName, quantity, direction (`long`/`short`), entryPrice, optional exitPrice/stopLoss, sanitized analysis HTML, images, customFields, owner, journal |
| `Planner` | `planner.models.js` | name, type, optional linkedJournal, owner |
| `PlanEntry` | `planEntry.models.js` | date (`YYYY-MM-DD` string), title, rich-text content, images, owner, planner |
| `Feedback` | `feedback.models.js` | user, overall rating, optional area ratings, message |
| `BugReport` | `bugReport.models.js` | user, title, description, steps, severity, page/userAgent, status |
| `AiReview` | `aiReview.models.js` | owner, journal, weekStart, input/context hashes, reviewed trade count, model, review payload |
| `AiRangeReview` | `aiRangeReview.models.js` | owner/journal, range boundaries and saved review payload; inspect model for exact fields/indexes |
| `AiUsage` | `aiUsage.models.js` | owner, journal, weekStart, Pacific day, success flag; TTL cleanup after 8 days |
| `MentorProgress` | `mentorProgress.models.js` | owner unique, trade fingerprints, completedAt, celebratedAt, legacy |
| `EmailVerification` | `emailVerification.models.js` | pending signup code: email, hashed OTP, expiry/attempt metadata, TTL purge date; the row is deleted when the code is accepted |
| `Custom field schema` | `customField.schema.js` | key, label, type (`text`, `number`, `date`, `checkbox`), mixed value |

### Key relationships and computed values

- `Trade.owner` and `Trade.journal` are references; controllers must ensure both match the authenticated user and requested journal.
- `Journal` exposes a virtual `trades` relationship via `Trade.journal`; trades are not embedded in the journal document.
- `Planner.linkedJournal` is optional and supports plan-vs-execution context.
- `PlanEntry` references both its owner and planner.
- Trade `status` and `pnl` are Mongoose virtuals, not persisted fields:
  - `status` is `open` when `exitPrice == null`, otherwise `closed`.
  - `pnl` is null for open trades; for closed trades it is `(exitPrice - entryPrice) * quantity` for long, sign-reversed for short.
- Image arrays generally contain URLs, not image binary data.
- Date-only planner entries use `YYYY-MM-DD` strings to avoid timezone day shifts. Trade `date` is a Date field.

## 6. Frontend state and data ownership

- `JournalContextProvider` is the shared client state owner for journal list, selected journal, normalized trade data, and save/sync behavior. It loads `/api/v1/journals` and normalizes backend documents into UI-facing objects.
- Journal/trade normalization happens in `frontend/src/context/journalContextProvider.jsx`. Be careful: it supports compatibility aliases such as `assetName`/`symbol`, `quantity`/`qty`, `entryPrice`/`entry`, and `exitPrice`/`exit`.
- `PlannerContextProvider` owns the planner list and CRUD state; planner entries are loaded through the planner entry hooks/services (not all embedded in the planner list).
- `frontend/src/services/` is the preferred location for feature API wrappers. Use `frontend/src/utils/http.js` where appropriate.
- `fetch(..., { credentials: 'include' })` is required for cookie-based requests.
- The frontend dispatches/listens to window events such as `auth-expired` and `auth-state-changed`; inspect existing flows before changing auth/session transitions.

## 7. Feature tracing index

Start with the relevant path below, then follow imports/callers only as needed.

| Feature | Frontend starting point | Backend starting point |
|---|---|---|
| Auth/signup/login/OTP | `pages/AuthPage.jsx`, `components/auth/` | `routes/user.routes.js`, `controllers/user.controller.js`, `loginOtp.controller.js`, `forgotPassword.controller.js`, `middlewares/auth.middleware.js` |
| Profile/preferences/header image | `hooks/useProfile.js`, `components/profile/` | `routes/user.routes.js`, `controllers/profile.controller.js` |
| Deep Mode focus timer + music | `components/rightContainer/planner/PlanForm.jsx` (header button, `sidePanel`), `FocusTimerPanel.jsx` + `hooks/useFocusTimer.js` + `utils/focusTimer.js` (timer: wall-clock end time in localStorage, no API), `MusicDialog.jsx` + `hooks/useYouTubePlayer.js` + `utils/musicLinks.js` (music; Spotify plain embed, YouTube IFrame API, no OAuth), `hooks/useFocusPreferences.js` | `PUT /auth/focus-preferences` (`verifyJWT`, writes only `req.user._id`) → `profile.controller.js` `setFocusPreferences`; links validated/canonicalized by `utils/musicLinks.js` (frontend twin: keep in sync); read back through `GET /auth/profile` → `focusPreferences` |
| Journals | `context/journalContextProvider.jsx`, `pages/MainJournal.jsx`, `components/sidebar/` | `routes/journal.routes.js`, `controllers/journal.controller.js`, `models/journal.models.js` |
| Trade logging/editing | `components/rightContainer/journal/TradeForm.jsx`, `TradeJournal.jsx`, journal context | `routes/trade.routes.js`, `controllers/trade.controller.js`, `models/trade.models.js` |
| Import | `components/rightContainer/journal/import/`, `services/importApi.js` | `routes/import.routes.js`, `controllers/import.controller.js`, `utils/exportData.js` (inspect actual imports) |
| Export | `components/rightContainer/journal/ExportJournalDialog.jsx`, `services/exportApi.js` | `routes/journal.routes.js`, `controllers/export.controller.js`, `utils/exporters.js`, `utils/exportRange.js` |
| Planner | `pages/PlannerPage.jsx`, `context/plannerContextProvider.jsx`, `hooks/usePlanEntries.js` | `routes/planner.routes.js`, `controllers/planner.controller.js`, `models/planner.models.js`, `models/planEntry.models.js` |
| Weekly AI mentor | `components/rightContainer/journal/AiMentorDialog.jsx`, `services/aiReviewApi.js` | `routes/aiReview.routes.js`, `controllers/aiReview.controller.js`, `utils/aiQuota.js`, `utils/geminiQueue.js`, `utils/aiMentorPrompt.js` |
| Date-range AI review | `components/rightContainer/journal/RangeReviewPanel.jsx`, `services/aiRangeReviewApi.js` | `routes/aiRangeReview.routes.js`, `controllers/aiRangeReview.controller.js`, `utils/aiRangePrompt.js` |
| Mentor unlock progress | `hooks/useMentorProgress.js`, `services/progressApi.js` | `routes/progress.routes.js`, `controllers/progress.controller.js`, `models/mentorProgress.models.js` |
| Market search/quotes/news | `pages/MarketResearchPage.jsx`, `services/marketApi.js`, `hooks/useLivePrice.js` | `routes/market.routes.js`, `controllers/market.controller.js`, `utils/marketData.js` |
| Feedback/bug report | `components/feedback/` | `routes/feedback.routes.js`, `controllers/feedback.controller.js` |
| Analytics dashboard | `components/rightContainer/journal/TradeAnalysis.jsx` (tabs: Overview, Breakdown, Distribution, Compare; instrument/strategy/setup filters), `analytics/` (tab components, charts, `MetricGate`), `MonthlyPnl.jsx`, `EquityCurve.jsx` | none: computed client-side from the already-loaded trades of ONE journal (so live and backtest never mix; journals can have different currencies, so there is deliberately no cross-journal total). One filtered trade list feeds every tab. Engine: `frontend/src/utils/tradeMetrics.js` (core metrics) and `utils/tradeBreakdowns.js` (day/time/holding/instrument/strategy/setup, distributions, range comparison); both pure, `npm test` in `frontend/`. Trades store a date only, so entry time, exit date, strategy and setup are read from the journal's custom properties (auto-detected by label, overridable in the Breakdown tab). Access: `frontend/src/config/analyticsAccess.js` (all `free`, `ENFORCE_METRIC_ACCESS = false`) consulted through `<MetricGate>`. Server twin for the AI mentor: `backend/src/utils/tradeStats.js` (keep definitions in sync) |
| Rich text/images | `components/common/tiptap/`, `utils/richText.js`, `utils/imageUpload.js` | `middlewares/multer.middleware.js`, relevant controller, `utils/cloudinary.js`, `utils/richText.js` |

## 8. AI mentor workflow notes

- Weekly and date-range reviews are separate API resources but share quota/guard infrastructure in the current implementation. Read `utils/aiQuota.js`, `utils/aiJobGuard.js`, `utils/geminiQueue.js`, and the relevant controller before changing generation behavior.
- Saved reviews are persisted; GET/preview/history endpoints are designed to read saved data and should not unexpectedly trigger a Gemini call.
- Review generation can be asynchronous/queued and protected by per-IP limits plus user/global quota controls. Failed generations should not consume user allowance.
- Review inputs include journal/trade context and may include planner carry-forward context. Keep owner scoping and live/backtest mode handling intact.
- Do not assume the AI unlock threshold or quota from this guide is permanent; inspect progress/quota utilities and controllers before modifying it.

## 9. Important invariants / common pitfalls

1. **Ownership:** every read/update/delete must be scoped to the authenticated user; never rely on an ID from the URL alone.
2. **Live vs backtest:** `Journal.mode` changes how trades should be interpreted by AI and UI. Preserve the distinction end-to-end.
3. **Currency:** `Journal.currency` is immutable; monetary calculations and displays must respect the journal currency.
4. **Trade field aliases:** the UI has legacy/compatibility aliases. Check normalization and all consumers before renaming fields.
5. **Open trades:** missing `exitPrice` means open; don't calculate realized P&L as if closed.
6. **Short trades:** P&L sign is reversed relative to long trades.
7. **Rich text:** strategy, analysis, and plan content may be HTML; sanitize at trust boundaries.
8. **Images:** persist Cloudinary URLs; handle image removal/update consistently with existing controller logic.
9. **Timezone:** planner day values are strings; do not casually convert them to JS Date objects.
10. **AI cost controls:** preserve queue, quota, retry/fallback, and failed-job refund behavior.
11. **Imports:** preview and commit are distinct. Do not bypass mapping/validation or the larger request-body configuration.
12. **Auth refresh:** the auth middleware can renew cookies; do not add unnecessary preflight auth calls or break event-driven reloads.
13. **Production serving:** backend may serve `frontend/dist`; deployment/build changes can affect both layers.

## 10. Useful targeted commands

```bash
# Find route mount / API endpoint
rg -n 'app.use\\(|router\\.(get|post|put|patch|delete)' backend/src

# Find model references and field usage
rg -n 'Journal|Trade|Planner|PlanEntry|AiReview|AiRangeReview' backend/src frontend/src

# Trace a frontend API call
rg -n 'fetch\\(|requestJson\\(|API_BASE|/api/v1' frontend/src

# Find middleware usage
rg -n 'verifyJWT|upload\\.single|rateLimit' backend/src

# Find a feature component
rg -n 'FeatureName|handlerName' frontend/src backend/src
```

## 11. When to update this document

Update this guide when a change materially affects:
- project structure or app entry points
- route mounts or authentication/middleware behavior
- database models, relationships, indexes, or persisted field semantics
- frontend state ownership or API data flow
- AI quota/generation architecture
- deployment/build/runtime behavior

Keep it concise and factual. Do not turn it into a changelog; feature-specific implementation details belong near the code.
