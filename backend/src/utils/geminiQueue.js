import { ApiError } from "./ApiError.js";
import { BUSY_MESSAGE } from "./gemini.js";

// A small in-process queue in front of Gemini. The free tier limits requests per minute for the whole API key,
// not per user, so every call goes through here: a few at a time and spaced apart. generateJson() already walks a
// chain of models when one is rate limited, so a 429 reaching this queue means EVERY model is limited right now:
// the queue then pauses briefly (so a burst of people does not hammer Gemini) and the request is turned away with a
// clear "try again" message. In-memory is fine for one server instance; use a shared queue (Redis) to scale out.

const int = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const maxConcurrent = () => int("AI_MAX_CONCURRENT", 2);
const minIntervalMs = () => int("AI_MIN_INTERVAL_MS", 4000);
const maxWaitMs = () => int("AI_MAX_QUEUE_WAIT_MS", 60_000);
const maxQueued = () => int("AI_MAX_QUEUE", 15);
// Hard ceiling for one running job: the Gemini layer has its own (shorter) deadline, this only guarantees that a stuck
// task can never hold a concurrency slot, and with it the whole queue, indefinitely.
const hardLimitMs = () => int("AI_JOB_HARD_LIMIT_MS", 140_000);
const MAX_PAUSE_MS = 2 * 60_000; // never lock everyone out for longer than this because of one 429
const DEFAULT_PAUSE_MS = 20_000;

const waiting = [];
let active = 0;
let lastStartAt = 0;
let pausedUntil = 0;
let timer = null;

const busyError = () => Object.assign(new ApiError(429, BUSY_MESSAGE), { rateLimited: true });

const arm = (job) => {
  clearTimeout(job.timeout);
  job.timeout = setTimeout(() => {
    const index = waiting.indexOf(job);
    if (index === -1) return;
    waiting.splice(index, 1);
    console.warn(`[ai-queue] turned away after waiting ${Date.now() - job.enqueuedAt}ms (queued=${waiting.length} active=${active})`);
    job.reject(busyError());
  }, maxWaitMs());
};

const run = async (job) => {
  const startedAt = Date.now();
  const waitedMs = startedAt - job.enqueuedAt;
  let outcome = "ok";
  let hardTimer;
  try {
    const hardLimit = new Promise((_, reject) => {
      hardTimer = setTimeout(() => {
        reject(Object.assign(new ApiError(503, "The AI mentor took too long to respond. Please try again in a few minutes."), { hardLimit: true }));
      }, hardLimitMs());
    });
    job.resolve(await Promise.race([job.task(), hardLimit]));
  } catch (error) {
    outcome = error?.hardLimit ? "hard-limit" : error?.rateLimited || error?.statusCode === 429 ? "rate-limited" : "error";
    // A 429 that came only from models already known to be cooling down teaches us nothing new: the queue was paused
    // when the cooldown started, so do not extend the pause again (requests are then turned away instantly, not queued).
    if ((error?.statusCode === 429 || error?.rateLimited) && !error?.skippedCooldown) {
      const pauseMs = Math.min(error.retryAfterMs ?? DEFAULT_PAUSE_MS, MAX_PAUSE_MS);
      pausedUntil = Math.max(pausedUntil, Date.now() + pauseMs);
      console.error(`[gemini-queue] rate limited; pausing the queue for ${Math.ceil(pauseMs / 1000)}s`);
    }
    job.reject(error);
  } finally {
    clearTimeout(hardTimer);
    active -= 1;
    console.log(`[ai-queue] waited=${waitedMs}ms ran=${Date.now() - startedAt}ms outcome=${outcome} active=${active} queued=${waiting.length}`);
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

/** Jobs running or waiting right now (used to let in-flight reviews finish on shutdown, and by the tests). */
export const queueStats = () => ({ active, waiting: waiting.length, pausedForMs: Math.max(0, pausedUntil - Date.now()) });

/** Runs `task` (which calls Gemini) when the queue allows it. Rejects with a 429 ApiError when the wait would be too long. */
export const runQueued = (task) =>
  new Promise((resolve, reject) => {
    if (pausedUntil - Date.now() > maxWaitMs()) return reject(busyError());
    if (waiting.length >= maxQueued()) return reject(busyError());

    const job = { task, resolve, reject, timeout: null, enqueuedAt: Date.now() };
    waiting.push(job);
    arm(job);
    pump();
  });
