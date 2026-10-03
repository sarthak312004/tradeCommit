# Deploying TradeCommit

One service serves everything: the Express API **and** the built React app, on one domain.
Stack: Render (host) + MongoDB Atlas (database) + Cloudinary (screenshots). All have free tiers.

## 1. Accounts / services
1. **MongoDB Atlas** - create a free M0 cluster, a database user, and under *Network Access* allow `0.0.0.0/0`
   (Render's free tier has no fixed IP). Copy the connection string from *Connect -> Drivers*.
2. **Cloudinary** - copy cloud name, API key, API secret from the dashboard.
3. **GitHub** - push this project (run `git status` first and make sure no `.env` file is staged).

## 2. Secrets
Generate two different secrets (run twice):

    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

## 3. Try the production build locally (recommended)
    cp backend/.env.example backend/.env      # fill in the values
    npm run build                              # installs deps + builds the frontend
    npm start                                  # open http://localhost:3000
Keep `NODE_ENV=development` for this local check (secure cookies need HTTPS). The server defaults to port 3000 if `PORT` is not set.

## 4. Deploy on Render
Option A - Blueprint: *New + -> Blueprint*, pick the repo (uses `render.yaml`), then fill
`MONGODB_CONNECTION_URL` and the three `CLOUDINARY_*` values. The service starts only after
MongoDB connects; `/api/health` reports unhealthy until the database is ready.

Option B - manual *Web Service*:
- Build command: `npm run build`
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
| `CORS_ORIGIN` | leave **empty** (same origin) |

Open the Render URL, register an account, add a trade with a screenshot.

## 5. Docker instead (any VPS / Railway / Fly.io)
    docker build -t tradecommit .
    docker run -p 3000:3000 -e NODE_ENV=production --env-file backend/.env tradecommit

## 6. Custom domain
Add it in the host's dashboard; HTTPS is issued automatically. Nothing in the app needs changing.

## Split deployment (frontend and API on different domains)
Not recommended, but if you do it: set `CORS_ORIGIN=https://your-frontend.com` on the API, and make the
frontend proxy/rewrite `/api/*` to the API (the app calls relative `/api/v1/...` URLs). Cookies then
automatically switch to `SameSite=None; Secure`.

## Known follow-ups
- **Rich text is stored and re-rendered as raw HTML.** Add server-side sanitising (e.g. `sanitize-html`
  for `analysis` in `trade.controller.js` and planner `content`) before you open sign-ups to the public.
- The login/register rate limiter is in memory (per instance, resets on restart).
- Render's free plan sleeps after inactivity (first request is slow); use a paid plan or a different host for always-on.
- Consider a Content-Security-Policy (e.g. via `helmet`) once you have tested it against the app.
- Back up your Atlas data (free M0 has no automated backups).
