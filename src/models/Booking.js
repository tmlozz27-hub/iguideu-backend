import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    travelerEmail: { type: String, required: true, lowercase: true, trim: true },
    travelerName: { type: String, default: "Traveler" },

    guideId: { type: String, required: true, trim: true },
    guideName: { type: String, required: true, trim: true },
    city: { type: String, default: "" },
    country: { type: String, default: "" },

    // tipo de reserva
    type: { type: String, enum: ["hour", "day", "24h"], default: "hour" },
    hoursRequested: { type: Number, default: 2 },

    // USD calculado
    totalUsd: { type: Number, default: 0 },

    // estado simple por ahora
    status: { type: String, enum: ["created", "paid", "cancelled"], default: "created" },
  },
  { timestamps: true }
);

export default mongoose.models.Booking || mongoose.model("Booking", BookingSchema);
