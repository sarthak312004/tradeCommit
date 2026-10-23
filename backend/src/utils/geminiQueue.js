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
    job.reject(busyError());
  }, maxWaitMs());
};

const run = async (job) => {
  try {
    job.resolve(await job.task());
  } catch (error) {
    if (error?.statusCode === 429 || error?.rateLimited) {
      const pauseMs = Math.min(error.retryAfterMs ?? DEFAULT_PAUSE_MS, MAX_PAUSE_MS);
      pausedUntil = Math.max(pausedUntil, Date.now() + pauseMs);
      console.error(`[gemini-queue] rate limited; pausing the queue for ${Math.ceil(pauseMs / 1000)}s`);
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
    if (pausedUntil - Date.now() > maxWaitMs()) return reject(busyError());
    if (waiting.length >= maxQueued()) return reject(busyError());

    const job = { task, resolve, reject, timeout: null };
    waiting.push(job);
    arm(job);
    pump();
  });
