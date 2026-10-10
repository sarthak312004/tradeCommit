import { ApiError } from "./ApiError.js";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
// Google retires model names from time to time. If the configured one stops existing (404) we retry once with the
// "latest flash" alias, so the mentor keeps working until GEMINI_MODEL is updated.
const FALLBACK_MODEL = "gemini-flash-latest";
const REQUEST_TIMEOUT_MS = 120_000; // newer "thinking" Flash models can take a while on a long journal

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const geminiModelName = () => (process.env.GEMINI_MODEL || "gemini-3.8-flash").trim();

const callOnce = async (model, apiKey, body) => {
  let response;
  try {
    response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new ApiError(504, timedOut ? "The AI mentor took too long to answer. Please try again." : "Could not reach the AI service. Please try again.");
  }

  if (response.ok) return response.json();

  const detail = await response.json().catch(() => null);
  const reason = detail?.error?.message ?? "";
  console.error(`Gemini ${model} responded ${response.status}: ${reason}`);

  if (response.status === 400 && body.generationConfig?.thinkingConfig && /think/i.test(reason)) {
    throw Object.assign(new ApiError(502, "This model does not accept the thinking setting."), { dropThinking: true });
  }
  if (response.status === 404) throw Object.assign(new ApiError(502, "The configured AI model is unavailable."), { modelMissing: true });
  if (response.status === 429) throw new ApiError(429, "The AI mentor is busy right now (free-tier limit reached). Try again in a minute.");
  if (response.status === 400 || response.status === 403) {
    // 400 covers an invalid key as well as a bad request; both are server configuration problems, not the user's
    throw new ApiError(502, "The AI service rejected the request. Check the server's GEMINI_API_KEY and GEMINI_MODEL.");
  }
  throw Object.assign(new ApiError(502, "The AI service is having trouble. Please try again shortly."), { retryable: response.status >= 500 });
};

/**
 * Calls Gemini and returns the parsed JSON object it produced.
 * `schema` is a Gemini responseSchema; the model is forced to answer in that shape.
 */
export const generateJson = async ({ system, prompt, schema }) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new ApiError(503, "The AI mentor is not configured on this server yet.");

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 8192, // headroom: "thinking" models spend part of this before writing the answer
      thinkingConfig: { thinkingLevel: "low" }, // a mentor review doesn't need deep reasoning; keeps it fast. Dropped automatically if the model rejects it
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  };

  let model = geminiModelName();
  let data;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      data = await callOnce(model, apiKey, body);
      break;
    } catch (error) {
      if (error.dropThinking) {
        delete body.generationConfig.thinkingConfig;
        continue;
      }
      if (error.modelMissing && model !== FALLBACK_MODEL) {
        model = FALLBACK_MODEL;
        continue;
      }
      if (error.retryable && attempt < 2) {
        await wait(1500 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }

  const candidate = data?.candidates?.[0];
  if (!candidate) {
    throw new ApiError(502, data?.promptFeedback?.blockReason ? "The AI could not review this journal's content." : "The AI returned an empty answer. Please try again.");
  }

  const text = (candidate.content?.parts ?? []).map((part) => part.text ?? "").join("").trim();
  try {
    return { result: JSON.parse(text), model };
  } catch {
    throw new ApiError(502, candidate.finishReason === "MAX_TOKENS" ? "The AI's answer was cut off. Please try again." : "The AI returned an unreadable answer. Please try again.");
  }
};
