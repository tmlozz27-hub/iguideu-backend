import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    traveler: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    guide: { type: String, required: true, trim: true, index: true },
    startAt: { type: Date, required: true, index: true },
    endAt:   { type: Date, required: true, index: true },
    price:   { type: Number, required: true, min: 1 },
    status:  {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

// endAt > startAt
BookingSchema.pre("validate", function (next) {
  if (this.startAt && this.endAt && this.endAt <= this.startAt) {
    return next(new Error("endAt must be greater than startAt"));
  }
  next();
});

BookingSchema.index({ guide: 1, startAt: 1 });
BookingSchema.index({ guide: 1, endAt: 1 });
BookingSchema.index({ traveler: 1, startAt: 1 });

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", BookingSchema);

export default Booking;
