import mongoose from "mongoose";

export const FEEDBACK_AREA_KEYS = ["easeOfUse", "ui", "functionality", "journaling"];

const oneToFive = {
  type: Number,
  min: [1, "Ratings go from 1 to 5"],
  max: [5, "Ratings go from 1 to 5"],
  validate: { validator: Number.isInteger, message: "Ratings must be whole numbers" },
};

// One document per submission: an overall 1-5 rating (required), optional 1-5 ratings per area, optional free text.
const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: { ...oneToFive, required: [true, "Please rate your overall experience"] },
    // separate ratings people can choose to give; a missing key means "not rated"
    ratings: {
      easeOfUse: oneToFive,
      ui: oneToFive, // "Look & feel"
      functionality: oneToFive,
      journaling: oneToFive, // "Journaling experience"
    },
    message: {
      type: String,
      trim: true,
      maxlength: [1000, "Message can be at most 1000 characters"],
      default: "",
    },
  },
  { timestamps: true }
);

export const Feedback = mongoose.model("Feedback", feedbackSchema);
