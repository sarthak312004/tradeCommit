import mongoose from "mongoose";

// A planner is a named container ("Nifty intraday", "Weekly swing") for dated trade plans.
// `type` is free text on purpose: the UI suggests Intraday / Swing / Position, but users can enter their own.
const plannerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Planner name is required"],
      trim: true,
      maxlength: [60, "Planner name can be at most 60 characters"],
    },
    type: {
      type: String,
      trim: true,
      maxlength: [30, "Planner type can be at most 30 characters"],
      default: "Intraday",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const Planner = mongoose.model("Planner", plannerSchema);
