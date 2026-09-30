import mongoose from "mongoose";

const journalSchema = new mongoose.Schema(
  {
    journalName: {
      type: String,
      required: [true, "Journal name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Optional: journal.populate("trades") works without storing an array
journalSchema.virtual("trades", {
  ref: "Trade",
  localField: "_id",
  foreignField: "journal",
});

export const Journal = mongoose.model("Journal", journalSchema);