import mongoose from "mongoose";

// user-defined extra properties (name + type + value) stored on each trade
const customFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true, trim: true, maxlength: 40 },
    type: { type: String, enum: ["text", "number", "date", "checkbox"], required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const tradeSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, "Trade date is required"],
    },
    assetName: {
      type: String,
      required: [true, "Asset name is required"],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity must be positive"],
    },
    direction: {
      type: String,
      enum: ["long", "short"],
      required: [true, "Direction is required"],
    },
    entryPrice: {
      type: Number,
      required: [true, "Entry price is required"],
    },
    exitPrice: {
      type: Number, // optional: empty means the trade is still open
    },
    stopLoss: {
      type: Number, // optional: initial stop, used to compute risk and the R multiple
      min: [0, "Stop loss must be positive"],
    },
    analysis: {
      type: String, // sanitized HTML from the rich text editor
      default: "",
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.every((item) => typeof item === "string"),
        message: "Images must be a list of strings",
      },
    },

    customFields: {
      type: [customFieldSchema],
      default: [],
    },

    // set by the backend, never sent from the form
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    journal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journal",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

tradeSchema.index({ journal: 1, date: -1 });

tradeSchema.virtual("status").get(function () {
  return this.exitPrice == null ? "open" : "closed";
});

tradeSchema.virtual("pnl").get(function () {
  if (this.exitPrice == null) return null;
  const diff = this.exitPrice - this.entryPrice;
  return (this.direction === "short" ? -diff : diff) * this.quantity;
});

export const Trade = mongoose.model("Trade", tradeSchema);