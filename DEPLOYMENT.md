# Deploying TradeCommit

The React frontend is deployed to Vercel, and the Express API runs as a separate
Render web service. Vercel proxies `/api/*` to Render, so browser requests and
authentication cookies stay on the Vercel origin.
Stack: Vercel + Render + MongoDB Atlas + Cloudinary.

## 1. Accounts / services
1. **MongoDB Atlas** - create a free M0 cluster, a database user, and under *Network Access* allow `0.0.0.0/0`
   (Render's free tier has no fixed IP). Copy the connection string from *Connect -> Drivers*.
2. **Cloudinary** - copy cloud name, API key, API secret from the dashboard.
3. **GitHub** - push this project (run `git status` first and make sure no `.env` file is staged).

## 2. Secrets
(Also create a free **Brevo** account, verify a sender email, and make an API key. Without `BREVO_API_KEY` and
`MAIL_FROM_EMAIL` on Render, nobody can sign up or reset a password because the code email cannot be sent.)
Create a **Gemini API key** in Google AI Studio and set `GEMINI_API_KEY` on Render to enable the weekly AI mentor.

Generate two different secrets (run twice):

    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

## 3. Try the production build locally (recommended)
    cp backend/.env.example backend/.env      # fill in the values
    npm run build                              # installs deps + builds the frontend
    npm start                                  # open http://localhost:3000
Keep `NODE_ENV=development` for this local check (secure cookies need HTTPS). The server defaults to port 3000 if `PORT` is not set.

## 4. Deploy the backend on Render
Create a Blueprint from the repository using `render.yaml`. It creates an API-only
service named `tradecommit-api`, rooted at `backend`. Add the MongoDB and Cloudinary
values in Render's dashboard; the Blueprint generates the access and refresh token
secrets. The service starts only after MongoDB connects; `/api/health` reports unhealthy
until the database is ready.

Alternatively, create a manual Render Web Service with:
- Root Directory: `backend`
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/api/health`
- Environment variables:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `MONGODB_CONNECTION_URL` | Atlas connection string |
| `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` | the generated secrets (32+ chars) |
| `ACCESS_TOKEN_EXPIRY` / `REFRESH_TOKEN_EXPIRY` | `1d` / `10d` |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | from Cloudinary |
| `BREVO_API_KEY` | Brevo -> SMTP & API -> API Keys (**required** for sign-up / password-reset codes) |
| `MAIL_FROM_EMAIL` | a sender you verified in Brevo -> Senders & IP (**required**) |
| `MAIL_FROM_NAME` | `TradeCommit` |
| `GOOGLE_CLIENT_ID` | optional; leave empty to hide the Google button |
| `GEMINI_API_KEY` | Google AI Studio API key; required for weekly AI mentor reviews |
| `GEMINI_MODEL` | Optional. Primary model, default `gemini-flash-latest` |
| `GEMINI_FALLBACK_MODELS` | Optional, comma separated. Tried in order when the primary is rate limited (429), missing (404) or overloaded (503). Default `gemini-flash-latest,gemini-flash-lite-latest` |
| `CORS_ORIGIN` | leave empty; Vercel proxies requests to this service |

Wait for the service to be live and copy its URL, for example
`https://tradecommit-api.onrender.com`.

## 5. Deploy the frontend on Vercel
Create a Vercel project from the same repository:
- Root Directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

Before deploying, edit `frontend/vercel.json` and replace
`https://YOUR-RENDER-SERVICE.onrender.com` with the Render URL from the previous step.
The config proxies `/api/*` to the backend and sends other routes to `index.html` for
client-side navigation. Push that change, then deploy or redeploy the Vercel project.

Verify the Vercel URL's `/api/health` responds with
`{"status":"ok","db":true}`. Then test registration, login, refreshing while logged in,
and adding a trade with a screenshot.

## 6. Docker instead (any VPS / Railway / Fly.io)
    docker build -t tradecommit .
    docker run -p 3000:3000 -e NODE_ENV=production --env-file backend/.env tradecommit

## 7. Custom domain
Add the custom domain to Vercel. Keep the API rewrite pointed at the Render backend;
the browser will still access both through the Vercel origin.

## Known follow-ups
- **Rich text is stored and re-rendered as raw HTML.** Add server-side sanitising (e.g. `sanitize-html`
  for `analysis` in `trade.controller.js` and planner `content`) before you open sign-ups to the public.
- The login/register rate limiter is in memory (per instance, resets on restart).
- Render's free plan sleeps after inactivity (first request is slow); use a paid plan or a different host for always-on.
- Consider a Content-Security-Policy (e.g. via `helmet`) once you have tested it against the app.
- Back up your Atlas data (free M0 has no automated backups).

## 8. Legal pages and Dodo Payments go-live

The app has short public pages at `/terms`, `/privacy`, `/refund-policy`, `/cancellation-policy`, and `/contact`.
Set `VITE_SUPPORT_EMAIL` from `frontend/.env.example` in Vercel's **Production** environment, then redeploy. It is
public website information, not a secret. Open each URL on your production site and check that it works without login
and that the support email is yours and monitored.

In Dodo, give them your real website and the policy URLs they ask for. Complete any business or payout details in
Dodo itself. Their exact review requirements can vary, so follow any specific feedback they send; having these pages
does not guarantee approval.

Before accepting live payments, make sure your Dodo products match the prices in `frontend/src/config/pricing.js`,
and configure the existing Dodo API key, product IDs, webhook URL/signing key, and `APP_URL` in Render from the
correct Dodo mode. Test checkout and subscription changes using test-mode credentials first. Keep Dodo secrets in
Render only, never in Vercel or `VITE_*` variables.

## 9. Progressive Web App (PWA), HTTPS, and Service Worker Caching

TradeCommit ships as an installable Progressive Web App with a web app manifest (`/manifest.webmanifest`), platform icons generated from `frontend/public/favicon.svg`, an offline fallback page (`/offline.html`), and a production-only service worker (`/sw.js`).

Installed-app icons use a fixed creamy-white (`#F3F0E8`) background, dark TradeCommit mark, and subtle inset hairline border (`#DAD6CD`) to distinguish the icon from light desktop surfaces. Desktop and mobile operating systems consume static manifest/touch-icon files and do not switch an installed icon when the system or in-app theme changes; the browser-tab SVG favicon remains system-theme-aware.

### HTTPS requirement
- Browser installation (`beforeinstallprompt` on Chromium and standalone service-worker registration) requires **HTTPS** in production. `http://localhost` and `http://127.0.0.1` are allowed for local production preview testing only.
- Both Vercel and Render provide HTTPS automatically. When using a custom domain or Docker reverse proxy, terminate TLS with a valid certificate and keep `NODE_ENV=production` so Express `trust proxy` is enabled.

### Service worker & caching rules
- The service worker is registered **only** in production builds (`import.meta.env.PROD`). Vite development (`npm run dev`) does not register a service worker, keeping HMR and development behavior predictable.
- During `npm run build` in `frontend/`, the `tradeCommitPwaPlugin` in `frontend/vite.config.js` stamps `dist/sw.js` with a deterministic SHA-256 cache version and the exact list of built static app-shell assets.
- **Strict privacy boundary:** `/sw.js` caches only safe static app-shell resources (HTML shell, hashed JS/CSS bundles under `/assets/*`, icons, manifest, and `/offline.html`). It **never** intercepts or caches `/api/*` requests, non-`GET` requests, credentials, cookies, journals, trades, planner entries, profile data, or cross-origin resources. Offline writes are never queued or replayed.
- **Update behavior:** New service workers do not call `skipWaiting()` automatically and never reload the page silently. When a newly deployed worker enters the `waiting` state, TradeCommit shows an "Update available" banner with explicit **Update** and **Dismiss / Later** actions so users never lose unsaved form drafts.
- **HTTP cache headers:** Ensure `/sw.js` is served with `Cache-Control: no-cache, no-store, must-revalidate` and `/manifest.webmanifest` with `Content-Type: application/manifest+json; charset=utf-8` (already configured in `frontend/vercel.json` and `backend/src/app.js`).

### Platform installation matrix
| Platform / Browser | Installation mechanism |
|---|---|
| Windows / Android (Chrome, Microsoft Edge) | Native browser prompt via the **Install app** button in the sidebar, profile menu, or header (uses `beforeinstallprompt`), or browser menu → **Install TradeCommit** / **Install app**. |
| macOS (Chrome, Microsoft Edge) | Native browser prompt via **Install app** or address-bar install icon. |
| macOS (Safari, macOS Sonoma+) | Clicking **Install app** opens step-by-step instructions for **File → Add to Dock…** (or **Share → Add to Dock…**). |
| iOS / iPadOS (Safari, Chrome) | Clicking **Install app** opens step-by-step instructions for **Share → Add to Home Screen → Add**. |
| Unsupported desktop browsers (e.g. Firefox Desktop) | No unsolicited install nudge is shown; native one-click installation is never falsely promised. |
