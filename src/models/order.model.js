import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 1 }, // centavos
    currency: { type: String, default: "usd" },
    status: {
      type: String,
      enum: [
        "created",
        "requires_payment_method",
        "requires_confirmation",
        "requires_action",
        "processing",
        "succeeded",
        "canceled",
        "failed",
        "pending",
      ],
      default: "created",
    },
    paymentIntentId: { type: String, required: true, index: true, unique: true },
    metadata: { type: Object, default: {} }, // { bookingId, guideId, userId, ... }
  },
  { timestamps: true }
);

export default mongoose.model("Order", OrderSchema);

