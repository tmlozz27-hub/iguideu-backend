// src/models/order.model.js
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    guideId: { type: mongoose.Schema.Types.ObjectId, ref: "Guide" },

    amount: { type: Number, required: true }, // en centavos
    currency: { type: String, default: "usd" },
    description: { type: String },

    paymentIntentId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "succeeded", "failed"],
      default: "pending",
      index: true,
    },
    // opcional: datos mínimos de cliente
    email: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
