import { ApiError } from "../utils/ApiError.js";

// Tiny in-memory limiter (no extra dependency). Fine for a single instance;
// use a shared store (e.g. Redis) if you ever scale to several instances.
//
// `refundFailed: true` gives the hit back when the request ends with an error (status >= 400), so failed attempts
// (for example an AI call that failed) do not eat the allowance. A handler can also set `res.locals.skipRateLimit = true`
// to refund a request that cost nothing, such as one answered from a saved result.
export const rateLimit = ({ windowMs, max, message = "Too many attempts, please try again later", refundFailed = false }) => {
  const hits = new Map();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweep.unref();

  const admit = (entry, res) => {
    res.once("finish", () => {
      const refund = res.locals?.skipRateLimit === true || (refundFailed && res.statusCode >= 400);
      if (refund && entry.count > 0) entry.count -= 1;
    });
  };

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      hits.set(key, fresh);
      admit(fresh, res);
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return next(new ApiError(429, message));
    }
    admit(entry, res);
    return next();
  };
};
