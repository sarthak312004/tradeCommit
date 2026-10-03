import { ApiError } from "../utils/ApiError.js";

// Tiny in-memory limiter (no extra dependency). Fine for a single instance;
// use a shared store (e.g. Redis) if you ever scale to several instances.
export const rateLimit = ({ windowMs, max, message = "Too many attempts, please try again later" }) => {
  const hits = new Map();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweep.unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return next(new ApiError(429, message));
    }
    return next();
  };
};
