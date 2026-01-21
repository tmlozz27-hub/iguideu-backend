// src/models/Booking.js
import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    travelerEmail: { type: String, required: true, index: true },
    guideName: { type: String, required: true },
    city: { type: String, default: "" },
    country: { type: String, default: "" },
    duration: { type: String, default: "HOURS" }, // HOURS | DAY | FULL_DAY_24H (por ahora libre)
    hours: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    status: { type: String, default: "PENDING" }, // PENDING | CONFIRMED | CANCELLED
  },
  { timestamps: true }
);

export default mongoose.models.Booking || mongoose.model("Booking", BookingSchema);

