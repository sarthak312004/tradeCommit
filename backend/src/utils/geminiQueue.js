import { ApiError } from "./ApiError.js";

// A small in-process queue in front of Gemini. The free tier limits requests per minute for the whole API key,
// not per user, so every call goes through here: a few at a time, spaced apart, and the whole queue pauses when
// Gemini answers 429. A request that would wait too long is turned away with a clear "try again" message instead
// of hanging. In-memory is fine for one server instance; use a shared queue (Redis) if you scale to several.

const int = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const maxConcurrent = () => int("AI_MAX_CONCURRENT", 2);
const minIntervalMs = () => int("AI_MIN_INTERVAL_MS", 6000); // 6s between starts = at most ~10 requests a minute
const maxWaitMs = () => int("AI_MAX_QUEUE_WAIT_MS", 60_000);
const maxQueued = () => int("AI_MAX_QUEUE", 15);
const DEFAULT_PAUSE_MS = 30_000;

const waiting = [];
let active = 0;
let lastStartAt = 0;
let pausedUntil = 0;
let timer = null;

const busyError = (waitMs) => {
  const minutes = Math.max(1, Math.ceil(waitMs / 60_000));
  return new ApiError(429, `The AI mentor is very busy right now. Please try again in ${minutes === 1 ? "a minute" : `about ${minutes} minutes`}. Your review allowance was not used.`);
};

const arm = (job) => {
  clearTimeout(job.timeout);
  job.timeout = setTimeout(() => {
    const index = waiting.indexOf(job);
    if (index === -1) return;
    waiting.splice(index, 1);
    job.reject(busyError(Math.max(pausedUntil - Date.now(), minIntervalMs() * (waiting.length + 1))));
  }, maxWaitMs());
};

const run = async (job) => {
  try {
    job.resolve(await job.task());
  } catch (error) {
    // Gemini said "slow down": pause everyone, and give this one request a single retry if the pause is short.
    if (error?.statusCode === 429) {
      const pauseMs = Math.min(error.retryAfterMs ?? DEFAULT_PAUSE_MS, 10 * 60_000);
      pausedUntil = Math.max(pausedUntil, Date.now() + pauseMs);
      if (!job.retried && pauseMs <= maxWaitMs()) {
        job.retried = true;
        waiting.unshift(job);
        arm(job);
        return;
      }
      job.reject(busyError(pauseMs));
      return;
    }
    job.reject(error);
  } finally {
    active -= 1;
    pump();
  }
};

function pump() {
  if (timer) return;
  while (waiting.length && active < maxConcurrent()) {
    const gate = Math.max(pausedUntil, lastStartAt + minIntervalMs());
    const now = Date.now();
    if (now < gate) {
      timer = setTimeout(() => {
        timer = null;
        pump();
      }, gate - now);
      return;
    }
    const job = waiting.shift();
    clearTimeout(job.timeout);
    active += 1;
    lastStartAt = Date.now();
    run(job);
  }
}

/** Runs `task` (which calls Gemini) when the queue allows it. Rejects with a 429 ApiError when the wait would be too long. */
export const runQueued = (task) =>
  new Promise((resolve, reject) => {
    const pauseLeft = pausedUntil - Date.now();
    if (pauseLeft > maxWaitMs()) return reject(busyError(pauseLeft));
    if (waiting.length >= maxQueued()) return reject(busyError(minIntervalMs() * waiting.length));

    const job = { task, resolve, reject, retried: false, timeout: null };
    waiting.push(job);
    arm(job);
    pump();
  });
