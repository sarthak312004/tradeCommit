import mongoose from "mongoose";

// One row per trader: how far along they are towards unlocking their first AI mentor review.
// `fingerprints` holds one short hash per distinct trade that has ever counted (never more than the target), so
// editing a trade, duplicating it, or deleting and re-adding the same trade can never earn a second point.
const mentorProgressSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    fingerprints: { type: [String], default: [] },
    completedAt: { type: Date, default: null },
    firstFeedbackAt: { type: Date, default: null },
    // when the trader saw the "feedback is here" moment; null means it is still waiting to be shown
    celebratedAt: { type: Date, default: null },
    // true for traders who already had enough trades when this feature shipped: they never see the celebration or badge
    legacy: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const MentorProgress = mongoose.model("MentorProgress", mentorProgressSchema);
