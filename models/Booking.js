// models/Booking.js
// Modelo de reservas – I GUIDE U Backend 24

import mongoose from "mongoose";

const { Schema } = mongoose;

const BookingExtensionSchema = new Schema(
  {
    fromHours: { type: Number },
    toHours: { type: Number },
    extraHours: { type: Number },
    extraAmountUsd: { type: Number },
    newDurationType: { type: String },
    stripeCheckoutSessionId: { type: String },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "cancelled", "failed"],
      default: "pending",
    },
  },
  { _id: false, timestamps: true }
);

const BookingSchema = new Schema(
  {
    // Referencias al guía
    guide: { type: Schema.Types.ObjectId, ref: "Guide" },
    guideId: { type: String, index: true },
    guideName: { type: String },
    city: { type: String },
    country: { type: String },

    // Viajero
    travelerName: { type: String },
    travelerEmail: { type: String, index: true },

    // Duración y montos
    durationType: {
      type: String,
      enum: ["HOURS", "FULL_DAY_8", "FULL_DAY_24", "CUSTOM"],
      default: "HOURS",
    },
    hours: { type: Number },

    baseAmountUsd: { type: Number },
    extraAmountUsd: { type: Number, default: 0 },
    totalAmountUsd: { type: Number },

    // Estado de pago
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "cancelled", "failed"],
      default: "pending",
      index: true,
    },
    stripeCheckoutSessionId: { type: String, index: true },
    stripePaymentIntentId: { type: String },

    // Extensiones futuras (ej: pasar de 8h a 24h, etc.)
    extensions: [BookingExtensionSchema],

    // Meta
    notes: { type: String },
    source: { type: String, default: "iguideu-frontend-demo" },
  },
  {
    timestamps: true,
  }
);

const Booking = mongoose.models.Booking || mongoose.model("Booking", BookingSchema);

export default Booking;
