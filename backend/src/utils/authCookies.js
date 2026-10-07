// Auth cookies shared by the login controller and the JWT middleware.
//
// The cookies carry an explicit maxAge. Without it they are "session cookies" and the browser
// deletes them when it is closed, which is what used to force a new login every time.

const isProd = process.env.NODE_ENV === "production";
const isCrossSite = isProd && Boolean(
  process.env.CORS_ORIGIN?.split(",").some((origin) => origin.trim())
);

const DEFAULT_SESSION_MS = 10 * 24 * 60 * 60 * 1000; // 10 days
const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

/** "10d" / "12h" / "30m" / "3600" (seconds) -> milliseconds. Falls back to `fallback` when unreadable. */
export const durationToMs = (value, fallback = DEFAULT_SESSION_MS) => {
  const match = /^\s*(\d+)\s*([smhdw]?)\s*$/i.exec(String(value ?? ""));
  if (!match) return fallback;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase() || "s";
  return amount > 0 ? amount * UNIT_MS[unit] : fallback;
};

// The login stays remembered for as long as the refresh token is valid.
export const sessionMaxAgeMs = () => durationToMs(process.env.REFRESH_TOKEN_EXPIRY);

export const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isCrossSite ? "none" : "lax",
};

/**
 * Both cookies live as long as the refresh token. An expired access token inside a still-present
 * cookie is renewed automatically by verifyJWT, so the user is not asked to log in again.
 */
export const setAuthCookies = (res, accessToken, refreshToken) =>
  res
    .cookie("accessToken", accessToken, { ...cookieOptions, maxAge: sessionMaxAgeMs() })
    .cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: sessionMaxAgeMs() });

export const clearAuthCookies = (res) =>
  res.clearCookie("accessToken", cookieOptions).clearCookie("refreshToken", cookieOptions);
