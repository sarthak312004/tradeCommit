import mongoose from "mongoose";

// One plan written for one calendar day (scope "day") or one week (scope "week") of a planner. A day can hold several plans.
const planEntrySchema = new mongoose.Schema(
  {
    // "YYYY-MM-DD" string (not a Date) so the plan stays on the day the user picked in every timezone
    date: {
      type: String,
      required: [true, "Plan date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Plan date must be YYYY-MM-DD"],
    },
    // Missing on entries saved before weekly plans existed: read those as "day". A weekly plan's `date` is the week's first day.
    scope: {
      type: String,
      enum: { values: ["day", "week"], message: 'Plan scope must be "day" or "week"' },
      default: "day",
    },
    title: {
      type: String,
      required: [true, "Plan title is required"],
      trim: true,
      maxlength: [120, "Plan title can be at most 120 characters"],
    },
    content: {
      type: String, // HTML from the rich text editor
      default: "",
    },
    images: {
      type: [String],
      default: [],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Planner",
      required: true,
    },
  },
  { timestamps: true }
);

planEntrySchema.index(
  { planner: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: { scope: "week" },
    name: "weekly_plan_per_planner_date",
  }
);

export const PlanEntry = mongoose.model("PlanEntry", planEntrySchema);
