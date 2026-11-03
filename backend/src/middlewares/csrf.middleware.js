import { ApiError } from "../utils/ApiError.js";

const configuredOrigins = () =>
  (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

const isAllowedOrigin = (origin, req) => {
  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }
  if (parsedOrigin.origin !== origin || !["http:", "https:"].includes(parsedOrigin.protocol)) return false;

  const allowedOrigins = configuredOrigins();
  if (allowedOrigins.length > 0) return allowedOrigins.includes(parsedOrigin.origin);

  const host = req.get("host");
  return Boolean(host && parsedOrigin.origin === `${req.protocol}://${host}`);
};

export const requireTrustedOrigin = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const origin = req.get("origin");
  if (!origin || !isAllowedOrigin(origin, req)) {
    return next(new ApiError(403, "Request origin is not allowed"));
  }
  return next();
};
