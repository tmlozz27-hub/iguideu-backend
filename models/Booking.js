import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    guideId: { type: String, required: true }, // código del guía, ej: g1001
    email: { type: String, required: true },
    amountUSD: { type: Number, required: true },
    stripeSessionId: { type: String, required: true },
    status: { type: String, default: "paid" } // paid / pending / cancelled
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
