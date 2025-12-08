const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    traveler: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    guide: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    stripeSessionId: { type: String },
    stripePaymentIntentId: { type: String },
    currency: { type: String, default: "usd" },
    amount: { type: Number, required: true },       // total
    feeAmount: { type: Number, required: true },    // 10% I GUIDE U

    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
