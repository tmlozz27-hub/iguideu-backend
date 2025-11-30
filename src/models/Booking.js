// src/models/Booking.js
import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    guideId: { type: String, required: true }, // id o code del guía
    guideName: { type: String, required: true },

    travelerName: { type: String, required: true },
    travelerEmail: { type: String, required: true },

    date: { type: String, required: true }, // ISO string (YYYY-MM-DD)
    hours: { type: Number, required: true, min: 1 },

    amount: { type: Number, required: true }, // en USD
    currency: { type: String, default: "usd" },

    status: {
      type: String,
      enum: ["pending", "paid", "cancelled", "refunded"],
      default: "pending",
    },

    stripeSessionId: { type: String }, // para vincular con Stripe después

    // Preparado para reembolsos / descuentos
    originalAmount: { type: Number },
    discountAmount: { type: Number },
    refundAmount: { type: Number },
  },
  {
    timestamps: true,
  }
);

const Booking = mongoose.model("Booking", BookingSchema);
export default Booking;
