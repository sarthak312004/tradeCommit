import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { queueStats, runQueued } from "./geminiQueue.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const gate = () => {
  let open;
  const promise = new Promise((resolve) => (open = resolve));
  return { promise, open };
};
const settle = async () => {
  for (let i = 0; i < 100 && (queueStats().active || queueStats().waiting); i += 1) await sleep(20);
};

beforeEach(async () => {
  process.env.AI_MAX_CONCURRENT = "2";
  process.env.AI_MIN_INTERVAL_MS = "5";
  process.env.AI_MAX_QUEUE_WAIT_MS = "300";
  process.env.AI_MAX_QUEUE = "3";
  process.env.AI_JOB_HARD_LIMIT_MS = "250";
  await settle();
});

describe("runQueued", () => {
  test("never runs more than the allowed number of jobs at once", async () => {
    let running = 0;
    let peak = 0;
    const job = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await sleep(40);
      running -= 1;
      return "done";
    };
    const out = await Promise.all([runQueued(job), runQueued(job), runQueued(job), runQueued(job)]);
    assert.deepEqual(out, ["done", "done", "done", "done"]);
    assert.equal(peak, 2);
  });

  test("saturation: a full queue turns new work away immediately with a 429", async () => {
    const g = gate();
    const held = [runQueued(() => g.promise), runQueued(() => g.promise)];
    await sleep(30);
    const queued = [runQueued(() => "q1"), runQueued(() => "q2"), runQueued(() => "q3")];
    await assert.rejects(() => runQueued(() => "overflow"), (error) => error.statusCode === 429 && error.rateLimited === true);
    g.open("x");
    assert.deepEqual(await Promise.all([...held, ...queued]), ["x", "x", "q1", "q2", "q3"]);
  });

  test("a waiting job is turned away after the maximum wait instead of waiting indefinitely", async () => {
    process.env.AI_JOB_HARD_LIMIT_MS = "5000"; // the running jobs must outlive the wait limit in this test
    const g = gate();
    const held = [runQueued(() => g.promise), runQueued(() => g.promise)];
    await sleep(30);
    const started = Date.now();
    await assert.rejects(() => runQueued(() => "late"), (error) => error.statusCode === 429);
    const waited = Date.now() - started;
    assert.ok(waited >= 250 && waited < 600, `waited ${waited}ms`);
    g.open("x");
    await Promise.all(held);
  });

  test("a stuck job is cut off by the hard limit and frees its slot", async () => {
    const started = Date.now();
    await assert.rejects(() => runQueued(() => new Promise(() => {})), (error) => error.hardLimit === true && error.statusCode === 503);
    assert.ok(Date.now() - started < 600);
    assert.equal(queueStats().active, 0);
    assert.equal(await runQueued(() => "next"), "next");
  });

  test("a real rate limit pauses the queue, but a cooldown-only 429 does not extend the pause", async () => {
    const limited = Object.assign(new Error("429"), { statusCode: 429, rateLimited: true, retryAfterMs: 150 });
    await assert.rejects(() => runQueued(() => Promise.reject(limited)));
    assert.ok(queueStats().pausedForMs > 0, "paused");
    await sleep(180);
    assert.equal(queueStats().pausedForMs, 0);

    const skipped = Object.assign(new Error("429"), { statusCode: 429, rateLimited: true, retryAfterMs: 60_000, skippedCooldown: true });
    await assert.rejects(() => runQueued(() => Promise.reject(skipped)));
    assert.equal(queueStats().pausedForMs, 0, "no new pause");
    assert.equal(await runQueued(() => "still fine"), "still fine");
  });
});
