import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    traveler: { type: mongoose.Types.ObjectId, ref: "User", index: true },
    guide: { type: String, required: true, index: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    price: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["pending", "confirmed", "canceled"], default: "pending", index: true }
  },
  { timestamps: true }
);

BookingSchema.index({ guide: 1, startAt: 1 });
BookingSchema.index({ guide: 1, endAt: 1 });
BookingSchema.index({ guide: 1, status: 1, startAt: 1 });

export default mongoose.model("Booking", BookingSchema);
