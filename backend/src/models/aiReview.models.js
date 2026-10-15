import mongoose from "mongoose";

// One saved AI mentor review per journal per week. Re-generating a week replaces its document, so repeated
// clicks never spend Gemini quota again unless the journal's trades or strategy actually changed.
const aiReviewSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    journal: { type: mongoose.Schema.Types.ObjectId, ref: "Journal", required: true },
    weekStart: { type: String, required: true }, // Monday, YYYY-MM-DD
    // fingerprint of everything the review was written from (strategy + trades); a mismatch means "stale"
    inputHash: { type: String, required: true },
    // fingerprint of the strategy, custom fields and connected plans only (no trades). When it differs from the
    // current one the trader rewrote their rules, which unlocks a refresh without needing new trades.
    contextHash: { type: String, default: "" },
    // how many trades the week held when this review was written; "new trades" are counted against it
    reviewedTradeCount: { type: Number, default: 0 },
    model: { type: String, default: "" },
    review: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

aiReviewSchema.index({ journal: 1, weekStart: 1 }, { unique: true });

export const AiReview = mongoose.model("AiReview", aiReviewSchema);
