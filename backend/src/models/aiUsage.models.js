import mongoose from "mongoose";

// One row per AI mentor generation that was admitted. It powers three limits:
//  - per-user caps (rows with ok: true in the last 24h / 7 days),
//  - the global daily budget that protects the shared Gemini free-tier quota (rows with today's `day`),
//  - nothing else: the review itself lives in AiReview.
// Rows are reserved before the Gemini call (ok: false) and flipped to ok: true when a review was saved. A failed
// call therefore never uses up a trader's allowance. Rows expire on their own after 8 days.
const aiUsageSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    journal: { type: mongoose.Schema.Types.ObjectId, ref: "Journal", required: true },
    weekStart: { type: String, required: true },
    day: { type: String, required: true }, // Pacific-time date, because Gemini's daily quota resets at midnight Pacific
    ok: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

aiUsageSchema.index({ owner: 1, createdAt: -1 });
aiUsageSchema.index({ day: 1 });
aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 8 * 24 * 60 * 60 });

export const AiUsage = mongoose.model("AiUsage", aiUsageSchema);
