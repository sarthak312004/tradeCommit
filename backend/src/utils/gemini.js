import { ApiError } from "./ApiError.js";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const int = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
// Read on every call so they can be tuned from the environment (and in tests) without a rebuild.
const requestTimeoutMs = () => int("GEMINI_REQUEST_TIMEOUT_MS", 60_000); // one HTTP call to one model
const deadlineMs = () => int("GEMINI_DEADLINE_MS", 110_000); // ALL models and retries of one generation together
const retryBackoffMs = () => int("GEMINI_RETRY_BACKOFF_MS", 1500);
const minCallMs = () => int("GEMINI_MIN_CALL_MS", 8_000); // not worth starting another call with less time than this left
const brokenModelCooldownMs = () => int("GEMINI_BROKEN_COOLDOWN_MS", 15_000); // skip a model that just timed out / kept failing
const FAST_FAILURE_RETRIES = 1; // extra tries on the SAME model, only for fast 5xx / network failures (never for a timeout)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const UNAVAILABLE_MESSAGE = "The AI mentor is temporarily unavailable. Please try again in a few minutes.";
const TIMEOUT_MESSAGE = "The AI mentor took too long to respond. Please try again in a few minutes.";

export const BUSY_MESSAGE = "The AI mentor is a little busy right now. Please try again in a few minutes. Your review wasn't charged.";

// Models are tried in this order. Free-tier quotas are PER MODEL, so when one model is rate limited (429), missing (404)
// or overloaded (503), the next one usually still has capacity. Configure with GEMINI_MODEL and GEMINI_FALLBACK_MODELS
// (comma separated).
export const geminiModelName = () => (process.env.GEMINI_MODEL || "gemini-flash-latest").trim();

const modelChain = () => {
  const extra = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-flash-latest,gemini-flash-lite-latest")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return [...new Set([geminiModelName(), ...extra])];
};

// model -> timestamp until which it is known to be rate limited / missing; skipped (not even called) until then.
const cooldowns = new Map();
// models that rejected the thinking setting once: do not waste a round trip re-learning that on every request
const noThinking = new Set();
const coolingUntil = (model) => cooldowns.get(model) ?? 0;
const cool = (model, ms) => cooldowns.set(model, Date.now() + ms);

const pacificMidnightMs = () => {
  // ms until the next midnight in Pacific time, when Gemini's daily free quota resets
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return ((23 - hour) * 60 + (60 - minute)) * 60_000;
};

// Gemini tells us how long to back off, either as a RetryInfo detail ("27s") or inside the message ("retry in 27.5s").
const retryDelayMs = (detail) => {
  const info = (detail?.error?.details ?? []).find((item) => typeof item?.retryDelay === "string");
  const text = info?.retryDelay ?? /retry in ([\d.]+)s/i.exec(detail?.error?.message ?? "")?.[1];
  const seconds = Number.parseFloat(text);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : undefined;
};

// true when the 429 is the DAILY quota (waiting a minute will not help) rather than the per-minute one
const isDailyQuota = (detail) => {
  const text = JSON.stringify(detail?.error?.details ?? []) + (detail?.error?.message ?? "");
  return /PerDay|per day|daily/i.test(text);
};

const callOnce = async (model, apiKey, body, timeoutMs) => {
  let response;
  try {
    response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    console.error(`[gemini] ${model}: ${timedOut ? "timed out" : `network error: ${error?.cause?.code ?? error?.message}`}`);
    // a timeout means the model is hung or slow: retrying it only repeats the wait, so move on to the next model instead
    if (timedOut) throw Object.assign(new ApiError(503, TIMEOUT_MESSAGE), { timedOut: true });
    throw Object.assign(new ApiError(503, UNAVAILABLE_MESSAGE), { transient: true });
  }

  if (response.ok) return response.json();

  const detail = await response.json().catch(() => null);
  const reason = detail?.error?.message ?? "";
  console.error(`[gemini] ${model} -> HTTP ${response.status} ${detail?.error?.status ?? ""}: ${reason.slice(0, 300)}`);

  if (response.status === 400 && body.generationConfig?.thinkingConfig && /think/i.test(reason)) {
    throw Object.assign(new ApiError(502, "This model does not accept the thinking setting."), { dropThinking: true });
  }
  if (response.status === 404) throw Object.assign(new ApiError(502, "The configured AI model is unavailable."), { modelMissing: true });
  if (response.status === 429) {
    const daily = isDailyQuota(detail);
    throw Object.assign(new ApiError(429, BUSY_MESSAGE), { rateLimited: true, daily, retryAfterMs: daily ? pacificMidnightMs() : retryDelayMs(detail) });
  }
  if (response.status === 401 || response.status === 403 || response.status === 400) {
    // an invalid key / bad request is a server configuration problem, not the trader's
    throw Object.assign(new ApiError(502, "The AI mentor is temporarily unavailable. Please try again in a few minutes."), { config: true });
  }
  throw Object.assign(new ApiError(502, "The AI service is having trouble. Please try again shortly. Your review wasn't charged."), { transient: response.status >= 500 });
};

/**
 * Calls Gemini and returns the parsed JSON object it produced.
 * `schema` is a Gemini responseSchema; the model is forced to answer in that shape.
 * Walks the model chain: a rate-limited, missing or overloaded model moves on to the next one instead of failing.
 */
export const generateJson = async ({ system, prompt, schema }) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new ApiError(503, "The AI mentor is temporarily unavailable. Please try again in a few minutes.");

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 16384, // headroom: "thinking" models spend part of this before writing the answer
      thinkingConfig: { thinkingLevel: "low" }, // keeps it fast; dropped automatically if the model rejects it
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  };

  const models = modelChain();
  const startedAt = Date.now();
  const remaining = () => deadlineMs() - (Date.now() - startedAt);
  let data;
  let usedModel;
  let lastError;
  let soonestRetryMs;
  let attemptedCalls = 0;
  let outOfTime = false;

  for (const model of models) {
    const left = coolingUntil(model) - Date.now();
    if (left > 0) {
      soonestRetryMs = Math.min(soonestRetryMs ?? left, left);
      continue;
    }
    if (remaining() < minCallMs()) {
      outOfTime = true;
      break;
    }

    // each model gets its own copy so dropping the thinking setting for one model never leaks into another
    const modelBody = { ...body, generationConfig: { ...body.generationConfig } };
    if (noThinking.has(model)) delete modelBody.generationConfig.thinkingConfig;

    let lastModelError;
    for (let retries = 0; ; ) {
      const timeoutMs = Math.min(requestTimeoutMs(), remaining());
      if (timeoutMs < minCallMs()) {
        outOfTime = true;
        break;
      }
      attemptedCalls += 1;
      const callStarted = Date.now();
      try {
        data = await callOnce(model, apiKey, modelBody, timeoutMs);
        usedModel = model;
        console.log(`[gemini] ${model} ok in ${Date.now() - callStarted}ms (total ${Date.now() - startedAt}ms, call ${attemptedCalls})`);
        break;
      } catch (error) {
        lastModelError = error;
        if (error.dropThinking) {
          delete modelBody.generationConfig.thinkingConfig; // not counted as a retry
          noThinking.add(model);
          continue;
        }
        // only a FAST 5xx / network failure is worth one more try on the same model, and only if there is time for it
        if (error.transient && retries < FAST_FAILURE_RETRIES && remaining() > retryBackoffMs() + minCallMs()) {
          retries += 1;
          await wait(retryBackoffMs());
          continue;
        }
        break; // give up on this model; the next one in the chain gets the remaining time
      }
    }
    if (data) break;

    lastError = lastModelError ?? lastError;
    if (lastModelError?.modelMissing) cool(model, 60 * 60_000);
    else if (lastModelError?.rateLimited) {
      const ms = Math.min(lastModelError.retryAfterMs ?? 30_000, 6 * 60 * 60_000);
      cool(model, ms);
      soonestRetryMs = Math.min(soonestRetryMs ?? ms, ms);
    } else if (lastModelError?.config) throw lastModelError; // another model will not fix a bad key
    else if (lastModelError?.timedOut || lastModelError?.transient) cool(model, brokenModelCooldownMs()); // a burst should not each wait on the same dead model
    if (outOfTime) break;
  }

  if (!data) {
    const elapsed = Date.now() - startedAt;
    console.error(`[gemini] gave up after ${elapsed}ms, ${attemptedCalls} call(s): ${lastError?.message ?? (outOfTime ? "out of time" : "all models cooling down")}`);
    if (lastError?.rateLimited || soonestRetryMs !== undefined) {
      // attemptedCalls === 0: every model was already cooling down, so nothing new was learned and the queue need not pause again
      throw Object.assign(new ApiError(429, BUSY_MESSAGE), { rateLimited: true, retryAfterMs: soonestRetryMs, skippedCooldown: attemptedCalls === 0 });
    }
    if (outOfTime && !lastError) throw new ApiError(503, TIMEOUT_MESSAGE);
    throw lastError ?? new ApiError(502, "The AI service is having trouble. Please try again shortly. Your review wasn't charged.");
  }

  const candidate = data?.candidates?.[0];
  if (!candidate) {
    throw new ApiError(503, "We couldn't complete your feedback just now. Please try again in a few minutes.");
  }

  const text = (candidate.content?.parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return { result: JSON.parse(text), model: usedModel };
  } catch {
    console.error(`[gemini] ${usedModel}: unreadable answer (finishReason ${candidate.finishReason})`);
    throw new ApiError(503, "We couldn't complete your feedback just now. Please try again in a few minutes.");
  }
};
