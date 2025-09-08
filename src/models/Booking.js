// src/models/Booking.js
import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["pending", "authorized", "paid", "refunded"], default: "pending" },
    feePct: { type: Number, default: 10 },
    feeAmount: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    ref: { type: String },
  },
  { _id: false }
);

const BookingSchema = new mongoose.Schema(
  {
    traveler: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    guide: { type: String, required: true }, // ej: g1001, g1002
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    price: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending" },
    payment: { type: PaymentSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model("Booking", BookingSchema);
