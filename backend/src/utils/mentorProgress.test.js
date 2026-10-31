import assert from "node:assert/strict";
import { test } from "node:test";
import { AiRangeReview } from "../models/aiRangeReview.models.js";
import { AiReview } from "../models/aiReview.models.js";
import { MentorProgress } from "../models/mentorProgress.models.js";
import { Trade } from "../models/trade.models.js";
import { getMentorProgress, mentorTarget, tradeFingerprint } from "./mentorProgress.js";

test("mentor progress reflects the remaining distinct trades after deletions", async (t) => {
  const target = mentorTarget();
  const ownerId = "test-owner";
  const existingTrades = Array.from({ length: Math.max(0, target - 1) }, (_, index) => ({
    assetName: `Asset ${index}`,
    date: new Date(`2025-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
    direction: "long",
    entryPrice: 100 + index,
    quantity: 1,
  }));
  const remainingTrades = existingTrades.slice(0, Math.max(0, target - 3));
  const progress = {
    fingerprints: existingTrades.map(tradeFingerprint),
    completedAt: null,
    celebratedAt: null,
    legacy: false,
  };
  let updatedFields;

  t.mock.method(MentorProgress, "findOne", async () => progress);
  t.mock.method(AiReview, "exists", async () => null);
  t.mock.method(AiRangeReview, "exists", async () => null);
  t.mock.method(Trade, "find", () => ({
    sort() { return this; },
    limit() { return this; },
    select() { return this; },
    lean: async () => remainingTrades,
  }));
  t.mock.method(MentorProgress, "findOneAndUpdate", async (_filter, update) => {
    updatedFields = update.$set;
    return { ...progress, ...updatedFields };
  });

  const result = await getMentorProgress(ownerId);

  assert.equal(result.count, remainingTrades.length);
  assert.equal(result.target, target);
  assert.equal(result.completed, false);
  assert.equal(result.completedAt, null);
  assert.equal(updatedFields.fingerprints.length, remainingTrades.length);
});

test("mentor progress permanently records the first saved feedback", async (t) => {
  const ownerId = "test-owner";
  const progress = {
    fingerprints: [],
    completedAt: null,
    firstFeedbackAt: null,
    celebratedAt: null,
    legacy: false,
  };
  let updatedFields;

  t.mock.method(MentorProgress, "findOne", async () => progress);
  t.mock.method(Trade, "find", () => ({
    sort() { return this; },
    limit() { return this; },
    select() { return this; },
    lean: async () => [],
  }));
  t.mock.method(AiReview, "exists", async () => ({ _id: "saved-review" }));
  t.mock.method(AiRangeReview, "exists", async () => null);
  t.mock.method(MentorProgress, "findOneAndUpdate", async (_filter, update) => {
    updatedFields = update.$set;
    return { ...progress, ...updatedFields };
  });

  const result = await getMentorProgress(ownerId);

  assert.equal(result.firstFeedbackReceived, true);
  assert.ok(updatedFields.firstFeedbackAt instanceof Date);
});
