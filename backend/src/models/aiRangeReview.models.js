import mongoose from "mongoose";

// One saved AI mentor review per journal per exact date range (rangeStart..rangeEnd, inclusive). It sits next to the
// weekly AiReview and is meant for traders whose trades play out over many days or weeks (swing traders), who get
// better feedback from one review of the whole stretch than from several weekly ones. Re-generating the same range
// replaces its document; a different range is a new document, so past feedback stays browsable.
const aiRangeReviewSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    journal: { type: mongoose.Schema.Types.ObjectId, ref: "Journal", required: true },
    rangeStart: { type: String, required: true }, // YYYY-MM-DD, inclusive
    rangeEnd: { type: String, required: true }, // YYYY-MM-DD, inclusive
    // fingerprint of everything the review was written from (range, strategy, trades, plans); a mismatch means "stale"
    inputHash: { type: String, required: true },
    // fingerprint of the strategy, custom fields and connected plans only (no trades): rewriting the rules unlocks a refresh
    contextHash: { type: String, default: "" },
    // trades inside the range when the review was written; "new trades" are counted against it
    reviewedTradeCount: { type: Number, default: 0 },
    // numbers of the range at that time, so the history list can show them without recomputing
    stats: { type: mongoose.Schema.Types.Mixed, default: null },
    model: { type: String, default: "" },
    review: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

aiRangeReviewSchema.index({ journal: 1, rangeStart: 1, rangeEnd: 1 }, { unique: true });
aiRangeReviewSchema.index({ journal: 1, owner: 1, updatedAt: -1 });

export const AiRangeReview = mongoose.model("AiRangeReview", aiRangeReviewSchema);
