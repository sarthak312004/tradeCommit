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
    model: { type: String, default: "" },
    review: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

aiReviewSchema.index({ journal: 1, weekStart: 1 }, { unique: true });

export const AiReview = mongoose.model("AiReview", aiReviewSchema);
