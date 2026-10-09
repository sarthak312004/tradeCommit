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
