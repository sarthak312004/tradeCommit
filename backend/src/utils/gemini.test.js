import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { generateJson } from "./gemini.js";

// Gemini is stubbed at the fetch level, so these exercise the real retry / fallback / deadline code.
const realFetch = globalThis.fetch;
const OK_BODY = { candidates: [{ content: { parts: [{ text: JSON.stringify({ headline: "h", summary: "s" }) }] } }] };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const hang = (init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason)));

let seq = 0;
let calls;
const useModels = (handler) => {
  seq += 1;
  const a = `ta-${seq}`;
  const b = `tb-${seq}`;
  process.env.GEMINI_MODEL = a;
  process.env.GEMINI_FALLBACK_MODELS = b;
  calls = [];
  globalThis.fetch = async (url, init) => {
    const model = decodeURIComponent(/models\/([^:]+):/.exec(String(url))[1]);
    calls.push(model);
    return handler(model, init, calls.filter((m) => m === model).length);
  };
  return { a, b };
};
const run = () => generateJson({ system: "s", prompt: "p", schema: {} });

let keepAlive;
beforeEach(() => {
  keepAlive = setInterval(() => {}, 1000); // AbortSignal.timeout timers are unref'd: keep the test process alive while a call "hangs"
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_REQUEST_TIMEOUT_MS = "400";
  process.env.GEMINI_DEADLINE_MS = "1500";
  process.env.GEMINI_MIN_CALL_MS = "50";
  process.env.GEMINI_RETRY_BACKOFF_MS = "30";
  process.env.GEMINI_BROKEN_COOLDOWN_MS = "200";
});
afterEach(() => {
  clearInterval(keepAlive);
  globalThis.fetch = realFetch;
});

describe("generateJson", () => {
  test("returns the parsed answer on success with one call", async () => {
    const { a } = useModels(() => json(200, OK_BODY));
    const out = await run();
    assert.deepEqual(out.result, { headline: "h", summary: "s" });
    assert.equal(out.model, a);
    assert.equal(calls.length, 1);
  });

  test("a timeout is NOT retried on the same model: it falls over to the next model", async () => {
    const { a, b } = useModels((model, init) => (model.startsWith("ta") ? hang(init) : json(200, OK_BODY)));
    const started = Date.now();
    const out = await run();
    assert.equal(out.model, b);
    assert.deepEqual(calls, [a, b]);
    assert.ok(Date.now() - started < 1200, "took one timeout, not three");
  });

  test("a fast 503 gets one retry on the same model, then succeeds", async () => {
    const { a } = useModels((model, init, n) => (n === 1 ? json(503, { error: { message: "overloaded" } }) : json(200, OK_BODY)));
    const out = await run();
    assert.equal(out.model, a);
    assert.equal(calls.length, 2);
  });

  test("persistent 503 on the primary falls back to the next model after a single retry", async () => {
    const { a, b } = useModels((model) => (model.startsWith("ta") ? json(503, { error: { message: "overloaded" } }) : json(200, OK_BODY)));
    const out = await run();
    assert.equal(out.model, b);
    assert.deepEqual(calls, [a, a, b]);
  });

  test("429 moves straight to the fallback model and the limited model is skipped afterwards", async () => {
    const { a, b } = useModels((model) =>
      model.startsWith("ta") ? json(429, { error: { message: "quota", details: [{ retryDelay: "30s" }] } }) : json(200, OK_BODY)
    );
    assert.equal((await run()).model, b);
    assert.deepEqual(calls, [a, b]);
    calls.length = 0;
    assert.equal((await run()).model, b);
    assert.deepEqual(calls, [b], "the rate limited model is not called again while it cools down");
  });

  test("every model 503: fails in bounded time with a friendly error", async () => {
    useModels(() => json(503, { error: { message: "overloaded" } }));
    const started = Date.now();
    await assert.rejects(run, (error) => {
      assert.ok([502, 503].includes(error.statusCode));
      assert.doesNotMatch(error.message, /overloaded|stack|\bat\b.*\.js/i);
      return true;
    });
    assert.ok(Date.now() - started < 1500);
    assert.equal(calls.length, 4, "1 try + 1 retry on each of the two models");
  });

  test("every model times out: total wait is bounded by the deadline and the error says so", async () => {
    useModels((model, init) => hang(init));
    const started = Date.now();
    await assert.rejects(run, (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.timedOut, true);
      assert.match(error.message, /took too long/);
      return true;
    });
    assert.ok(Date.now() - started < 1500, `waited ${Date.now() - started}ms`);
    assert.equal(calls.length, 2);
  });

  test("every model rate limited: 429 busy error, then instant 'skippedCooldown' answers without calling Gemini", async () => {
    useModels(() => json(429, { error: { message: "quota", details: [{ retryDelay: "30s" }] } }));
    await assert.rejects(run, (error) => error.statusCode === 429 && error.rateLimited === true && !error.skippedCooldown);
    calls.length = 0;
    await assert.rejects(run, (error) => error.statusCode === 429 && error.skippedCooldown === true);
    assert.equal(calls.length, 0);
  });

  test("a model that rejects the thinking setting is retried without it, and remembered", async () => {
    const bodies = [];
    useModels((model, init) => {
      const body = JSON.parse(init.body);
      bodies.push(Boolean(body.generationConfig.thinkingConfig));
      return body.generationConfig.thinkingConfig ? json(400, { error: { message: "thinking is not supported" } }) : json(200, OK_BODY);
    });
    await run();
    assert.deepEqual(bodies, [true, false]);
    await run();
    assert.deepEqual(bodies, [true, false, false], "second request does not waste a round trip");
  });
});
