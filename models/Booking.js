import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    guideName: { type: String, required: true },
    city: { type: String },
    country: { type: String },
    duration: { type: String }, // Ej: "HOURS (3 hs)", "DAY (8 hs)"
    total: { type: Number, required: true }, // Total en USD
    email: { type: String },
    extra: { type: String },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "CANCELLED"],
      default: "PENDING",
    },
    stripeCheckoutSessionId: { type: String },
    meta: { type: Object }, // durationType, hoursCount, etc.
  },
  { timestamps: true }
);

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

export default Booking;
