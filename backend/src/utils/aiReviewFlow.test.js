// End-to-end checks of weekly + date-range AI feedback through the real Express app and a real MongoDB, with Gemini
// stubbed at the fetch level. Runs only when TEST_MONGODB_URL points at a disposable MongoDB; otherwise it is skipped.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

const MONGO = process.env.TEST_MONGODB_URL;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const realFetch = globalThis.fetch;

describe("AI feedback end to end", { skip: !MONGO && "set TEST_MONGODB_URL to run" }, () => {
  let mongoose, server, base, jwt, models, quota;
  let geminiCalls = [];
  let geminiHandler;
  let keepAlive;
  let seq = 0;

  const ok = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ headline: "Solid week", summary: "You followed most rules." }) }] } }] }), { status: 200 });
  const fail = (status, extra = {}) => new Response(JSON.stringify({ error: { message: "upstream", ...extra } }), { status });
  const hang = (init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason)));

  const useGemini = (handler) => {
    seq += 1;
    process.env.GEMINI_MODEL = `m-a-${seq}`;
    process.env.GEMINI_FALLBACK_MODELS = `m-b-${seq}`;
    geminiCalls = [];
    geminiHandler = handler;
  };

  before(async () => {
    Object.assign(process.env, {
      NODE_ENV: "test",
      ACCESS_TOKEN_SECRET: "test-secret",
      REFRESH_TOKEN_SECRET: "test-refresh",
      ACCESS_TOKEN_EXPIRY: "1h",
      REFRESH_TOKEN_EXPIRY: "1d",
      GEMINI_API_KEY: "k",
      GEMINI_REQUEST_TIMEOUT_MS: "1200",
      GEMINI_DEADLINE_MS: "3000",
      GEMINI_MIN_CALL_MS: "100",
      GEMINI_RETRY_BACKOFF_MS: "40",
      GEMINI_BROKEN_COOLDOWN_MS: "100",
      AI_MIN_INTERVAL_MS: "5",
      AI_MAX_QUEUE_WAIT_MS: "1500",
      AI_MAX_CONCURRENT: "2",
      AI_MAX_QUEUE: "15",
      AI_JOB_HARD_LIMIT_MS: "5000",
    });
    keepAlive = setInterval(() => {}, 1000);
    ({ default: mongoose } = await import("mongoose"));
    jwt = (await import("jsonwebtoken")).default;
    await mongoose.connect(MONGO, { dbName: `tc_flow_${Date.now()}` });

    globalThis.fetch = (url, init) => {
      if (!String(url).includes("generativelanguage.googleapis.com")) return realFetch(url, init);
      const model = decodeURIComponent(/models\/([^:]+):/.exec(String(url))[1]);
      geminiCalls.push(model);
      return Promise.resolve(geminiHandler(model, init, geminiCalls.filter((m) => m === model).length));
    };

    const { app } = await import("../app.js");
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;

    models = {
      User: (await import("../models/user.models.js")).User,
      Journal: (await import("../models/journal.models.js")).Journal,
      Trade: (await import("../models/trade.models.js")).Trade,
      AiUsage: (await import("../models/aiUsage.models.js")).AiUsage,
      AiRangeReview: (await import("../models/aiRangeReview.models.js")).AiRangeReview,
      AiReview: (await import("../models/aiReview.models.js")).AiReview,
    };
    quota = await import("./aiQuota.js");
  });

  after(async () => {
    clearInterval(keepAlive);
    globalThis.fetch = realFetch;
    server?.closeAllConnections?.();
    await new Promise((resolve) => server?.close(resolve));
    await mongoose?.connection.db.dropDatabase();
    await mongoose?.disconnect();
  });

  // a trader with a journal that has a strategy and 5 trades in the week of Mon 2026-09-28
  const makeTrader = async () => {
    const n = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    const user = await models.User.create({ username: `u${n}`, email: `u${n}@example.com` });
    const journal = await models.Journal.create({ journalName: "J", owner: user._id, context: { strategy: "Trade only breakouts with a 1R stop and risk 1% per trade" } });
    for (let day = 28; day <= 32; day += 1) {
      const date = day <= 30 ? `2026-09-${day}` : `2026-10-0${day - 30}`;
      await models.Trade.create({ date: new Date(`${date}T00:00:00Z`), assetName: "EURUSD", quantity: 1, direction: "long", entryPrice: 1, exitPrice: 1.01, stopLoss: 0.99, owner: user._id, journal: journal._id });
    }
    const cookie = `accessToken=${jwt.sign({ _id: String(user._id) }, process.env.ACCESS_TOKEN_SECRET)}`;
    return { user, journal, cookie, range: { start: "2026-09-28", end: "2026-10-10" } };
  };
  const call = async (trader, method, path, body, signal) => {
    const response = await realFetch(`${base}/api/v1/journals/${trader.journal._id}/${path}`, {
      method,
      headers: { cookie: trader.cookie, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  };
  const postRange = (trader, range = trader.range, signal) => call(trader, "POST", "ai-range-reviews", range, signal);
  const rows = (trader) => models.AiUsage.find({ owner: trader.user._id }).lean();

  test("successful range feedback is saved, charged once, and a repeat costs nothing", async () => {
    useGemini(() => ok());
    const t = await makeTrader();
    const res = await postRange(t);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.review.headline, "Solid week");
    assert.equal(await models.AiRangeReview.countDocuments({ owner: t.user._id }), 1);
    const usage = await rows(t);
    assert.deepEqual(usage.map((r) => r.ok), [true]);
    const again = await postRange(t);
    assert.equal(again.status, 200);
    assert.equal(geminiCalls.length, 1, "no second Gemini call for an unchanged range");
    assert.equal((await rows(t)).length, 1);
  });

  test("successful weekly feedback is saved and charged once", async () => {
    useGemini(() => ok());
    const t = await makeTrader();
    const res = await call(t, "POST", "ai-review", { weekStart: "2026-09-28" });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.review.headline, "Solid week");
    assert.equal(await models.AiReview.countDocuments({ owner: t.user._id }), 1);
    assert.deepEqual((await rows(t)).map((r) => r.ok), [true]);
  });

  test("Gemini timeout on the primary falls back to the next model quickly", async () => {
    useGemini((model, init) => (model.startsWith("m-a") ? hang(init) : ok()));
    const t = await makeTrader();
    const started = Date.now();
    const res = await postRange(t);
    assert.equal(res.status, 200);
    assert.match(res.body.data.model, /^m-b/);
    assert.equal(geminiCalls.filter((m) => m.startsWith("m-a")).length, 1, "the hung model is tried once, not three times");
    assert.ok(Date.now() - started < 2500);
    assert.deepEqual((await rows(t)).map((r) => r.ok), [true]);
  });

  test("a single 503 is retried once on the same model and succeeds", async () => {
    useGemini((model, init, n) => (n === 1 ? fail(503) : ok()));
    const t = await makeTrader();
    const res = await postRange(t);
    assert.equal(res.status, 200);
    assert.equal(geminiCalls.length, 2);
    assert.deepEqual((await rows(t)).map((r) => r.ok), [true]);
  });

  test("every model returns 503: friendly error, nothing saved, nothing charged", async () => {
    useGemini(() => fail(503));
    const t = await makeTrader();
    const res = await postRange(t);
    assert.ok([502, 503].includes(res.status), `status ${res.status}`);
    assert.match(res.body.message, /charged|allowance was not used/);
    assert.doesNotMatch(JSON.stringify(res.body), /node_modules|\bat .*\.js:\d+/);
    assert.equal(await models.AiRangeReview.countDocuments({ owner: t.user._id }), 0);
    assert.equal((await rows(t)).length, 0);
  });

  test("every model returns 429: busy answer, nothing charged, and the next request is turned away without calling Gemini", async () => {
    useGemini(() => fail(429, { details: [{ retryDelay: "2s" }] }));
    const t = await makeTrader();
    const res = await postRange(t);
    assert.equal(res.status, 429);
    assert.match(res.body.message, /busy/i);
    assert.equal((await rows(t)).length, 0);
    const before = geminiCalls.length;
    const second = await postRange(t); // the queue is paused for the limit's duration, so this never reaches Gemini
    assert.equal(second.status, 429);
    assert.equal(geminiCalls.length, before);
    assert.equal((await rows(t)).length, 0);
    await sleep(2200); // let the shared queue pause end so the next tests start clean
  });

  test("double click: two identical requests share one Gemini call and one charge", async () => {
    useGemini(async () => {
      await sleep(300);
      return ok();
    });
    const t = await makeTrader();
    const [a, b] = await Promise.all([postRange(t), postRange(t)]);
    assert.deepEqual([a.status, b.status], [200, 200]);
    assert.equal(geminiCalls.length, 1);
    assert.deepEqual((await rows(t)).map((r) => r.ok), [true]);
    assert.equal(await models.AiRangeReview.countDocuments({ owner: t.user._id }), 1);
  });

  test("two different ranges at once for one trader: one runs, the other is refused, one charge", async () => {
    useGemini(async () => {
      await sleep(300);
      return ok();
    });
    const t = await makeTrader();
    const results = await Promise.all([postRange(t), postRange(t, { start: "2026-09-28", end: "2026-10-12" })]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 429]);
    assert.equal(geminiCalls.length, 1);
    assert.deepEqual((await rows(t)).map((r) => r.ok), [true]);
  });

  test("duplicate from ANOTHER instance (shared database only): refused, no Gemini call, no extra charge", async () => {
    useGemini(() => ok());
    const t = await makeTrader();
    const other = await models.AiUsage.create({ owner: t.user._id, journal: t.journal._id, weekStart: "2026-09-28", day: quota.pacificDayKey() }); // pending row of another instance
    const res = await postRange(t);
    assert.equal(res.status, 429);
    assert.match(res.body.message, /still being written/);
    assert.equal(geminiCalls.length, 0);
    const left = await rows(t);
    assert.deepEqual(left.map((r) => String(r._id)), [String(other._id)], "only the other instance's reservation remains");
    assert.equal(await quota.isGenerating(t.user._id), true);
  });

  test("two instances racing: exactly one reservation survives", async () => {
    const t = await makeTrader();
    const attempt = () => quota.reserveUsage({ ownerId: t.user._id, journalId: t.journal._id, weekStart: "2026-09-28" }).then(() => "won", (e) => e.statusCode);
    const outcome = await Promise.all([attempt(), attempt(), attempt()]);
    assert.equal(outcome.filter((o) => o === "won").length, 1);
    assert.equal((await rows(t)).length, 1);
  });

  test("queue saturation: overflow requests are turned away and refunded, the rest succeed", async () => {
    process.env.AI_MAX_QUEUE = "1";
    useGemini(async () => {
      await sleep(500);
      return ok();
    });
    const traders = await Promise.all([makeTrader(), makeTrader(), makeTrader(), makeTrader(), makeTrader()]);
    const results = await Promise.all(traders.map((t) => postRange(t)));
    process.env.AI_MAX_QUEUE = "15";
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
    for (const [index, result] of results.entries()) {
      const usage = await rows(traders[index]);
      assert.deepEqual(usage.map((r) => r.ok), result.status === 200 ? [true] : [], "refused requests are not charged");
    }
  });

  test("network interruption: the server finishes and saves, and the client recovers through status + preview", async () => {
    useGemini(async () => {
      await sleep(900);
      return ok();
    });
    const t = await makeTrader();
    const controller = new AbortController();
    const pending = postRange(t, t.range, controller.signal).catch((error) => error.name);
    await sleep(250);
    controller.abort(); // the browser's connection drops mid-request
    assert.equal(await pending, "AbortError");

    const during = await call(t, "GET", `ai-range-reviews/status?start=${t.range.start}&end=${t.range.end}`);
    assert.equal(during.body.data.generating, true);
    assert.equal(during.body.data.savedAt, null);

    let status;
    for (let i = 0; i < 40; i += 1) {
      await sleep(150);
      status = (await call(t, "GET", `ai-range-reviews/status?start=${t.range.start}&end=${t.range.end}`)).body.data;
      if (status.savedAt && !status.generating) break;
    }
    assert.ok(status.savedAt, "review was saved after the client went away");
    assert.equal(status.generating, false);
    const preview = await call(t, "GET", `ai-range-reviews/preview?start=${t.range.start}&end=${t.range.end}`);
    assert.equal(preview.body.data.review.headline, "Solid week");
    assert.equal(preview.body.data.generatedAt, status.savedAt, "status.savedAt matches what the client compares against");
    assert.deepEqual((await rows(t)).map((r) => r.ok), [true]);
    assert.equal(geminiCalls.length, 1);
  });

  test("failed save is reported as an error, never as saved, and is not charged", async () => {
    useGemini(() => ok());
    const t = await makeTrader();
    const original = models.AiRangeReview.findOneAndUpdate;
    models.AiRangeReview.findOneAndUpdate = () => { throw new Error("db down"); };
    let res;
    try {
      res = await postRange(t);
    } finally {
      models.AiRangeReview.findOneAndUpdate = original;
    }
    assert.equal(res.status, 500);
    assert.equal(await models.AiRangeReview.countDocuments({ owner: t.user._id }), 0);
    assert.equal((await rows(t)).length, 0);
  });

  test("status endpoint validates input and respects ownership", async () => {
    const t = await makeTrader();
    const other = await makeTrader();
    assert.equal((await call(t, "GET", "ai-range-reviews/status?start=bad&end=2026-10-01")).status, 400);
    const foreign = await realFetch(`${base}/api/v1/journals/${other.journal._id}/ai-range-reviews/status?start=2026-09-28&end=2026-10-05`, { headers: { cookie: t.cookie } });
    assert.equal(foreign.status, 404);
    assert.equal((await realFetch(`${base}/api/v1/journals/${t.journal._id}/ai-range-reviews/status?start=2026-09-28&end=2026-10-05`)).status, 401);
  });

  test("shutdown hands back reservations of unfinished generations", async () => {
    const t = await makeTrader();
    let finish;
    const work = quota.withUsageReservation({ ownerId: t.user._id, journalId: t.journal._id, weekStart: "2026-09-28" }, () => new Promise((resolve) => (finish = resolve)));
    await sleep(100);
    assert.equal(quota.pendingReservationCount(), 1);
    assert.equal((await rows(t)).length, 1);
    await quota.releasePendingReservations();
    assert.equal((await rows(t)).length, 0);
    finish("late");
    await work;
    assert.equal(quota.pendingReservationCount(), 0);
  });
});
