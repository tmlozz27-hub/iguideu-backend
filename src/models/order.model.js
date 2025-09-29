// src/models/order.model.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

const LastErrorSchema = new Schema(
  {
    code: { type: String },
    message: { type: String },
    type: { type: String },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 1 }, // en minor units (cents)
    currency: { type: String, required: true, lowercase: true, trim: true, default: "usd" },

    status: {
      type: String,
      required: true,
      enum: [
        "requires_payment_method",
        "requires_action",
        "processing",
        "succeeded",
        "canceled",
        "failed",
      ],
      default: "requires_payment_method",
      index: true,
    },

    paymentIntentId: { type: String, required: true, index: true },

    // Info adicional útil para auditoría/diagnóstico
    metadata: { type: Schema.Types.Mixed, default: {} },
    latestChargeId: { type: String },
    lastError: { type: LastErrorSchema },
  },
  {
    timestamps: true, // createdAt / updatedAt
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        // opcional: mantener _id como string y no mostrar nada sensible
        if (ret._id && ret._id.toString) ret._id = ret._id.toString();
        return ret;
      },
    },
  }
);

/**
 * Índices recomendados
 * - paymentIntentId: búsqueda directa por PI desde el webhook / el frontend
 * - createdAt: listados recientes
 * - status: listados/estadísticas por estado
 */
OrderSchema.index({ paymentIntentId: 1 }, { unique: false });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

const Order = model("Order", OrderSchema);
export default Order;
