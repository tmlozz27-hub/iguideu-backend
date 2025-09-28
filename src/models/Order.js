import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true }, // en centavos
    currency: { type: String, default: "usd" },
    paymentIntentId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["created", "pending", "processing", "requires_action", "requires_confirmation", "succeeded", "failed"],
      default: "created",
      index: true,
    },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", OrderSchema);
