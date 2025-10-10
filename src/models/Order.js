import mongoose from "mongoose";

const RefundSchema = new mongoose.Schema(
  {
    id: String,
    amount: Number,
    currency: String,
    status: String,
    created: Number,
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    paymentIntentId: { type: String, index: true, unique: true },
    amount: Number,
    currency: String,
    status: String, // requires_payment_method | processing | succeeded | partially_refunded | refunded | canceled
    metadata: { type: Object, default: {} },

    // 👇 nuevos
    refundedAmount: { type: Number, default: 0 }, // en cents
    refunds: { type: [RefundSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", OrderSchema);
