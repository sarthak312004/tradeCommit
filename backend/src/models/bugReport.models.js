import mongoose from "mongoose";

export const BUG_SEVERITIES = ["minor", "major", "critical"];

const bugReportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Give the bug a short title"],
      trim: true,
      maxlength: [100, "Title can be at most 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Describe what happened"],
      trim: true,
      maxlength: [2000, "Description can be at most 2000 characters"],
    },
    steps: {
      type: String,
      trim: true,
      maxlength: [1000, "Steps can be at most 1000 characters"],
      default: "",
    },
    severity: {
      type: String,
      enum: BUG_SEVERITIES,
      default: "minor",
    },
    // captured automatically to make the report easier to reproduce
    page: { type: String, trim: true, maxlength: 200, default: "" },
    userAgent: { type: String, trim: true, maxlength: 300, default: "" },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
    },
  },
  { timestamps: true }
);

export const BugReport = mongoose.model("BugReport", bugReportSchema);
