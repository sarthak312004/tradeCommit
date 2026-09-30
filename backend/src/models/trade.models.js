import mongoose from "mongoose";

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
    analysis: {
      type: String, // sanitized HTML from the rich text editor
      default: "",
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