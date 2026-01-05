import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    guideId: { type: mongoose.Schema.Types.ObjectId, ref: "Guide", required: true },
    travelerEmail: { type: String, required: true },
    travelerName: { type: String, default: "" },
    startDate: { type: String, required: true },
    hoursRequested: { type: Number, required: true },
    notes: { type: String, default: "" },
    status: { type: String, default: "pending" }
  },
  { timestamps: true }
);

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", BookingSchema);

export default Booking;
