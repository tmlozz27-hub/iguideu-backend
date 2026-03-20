import mongoose from "mongoose";

const GuideSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    city: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    languages: { type: [String], default: [] },
    avatarUrl: { type: String, default: "" },
    bio: { type: String, default: "" },
    priceHour: { type: Number, default: 0 },
    priceDay: { type: Number, default: 0 },
    priceFullDay24h: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    membership: {
      active: { type: Boolean, default: false },
      required: { type: Boolean, default: false },
      monthlyFeeUsd: { type: Number, default: 10 },
      requiredFromBookingCount: { type: Number, default: 2 },
      startedAt: { type: Date, default: null }
    },

    stats: {
      totalPaidBookings: { type: Number, default: 0 },
      firstPaidBookingAt: { type: Date, default: null },
      secondPaidBookingAt: { type: Date, default: null },
      lastPaidBookingAt: { type: Date, default: null },
      lastPaidBookingId: { type: String, default: "" }
    }
  },
  { timestamps: true }
);

export default mongoose.models.Guide || mongoose.model("Guide", GuideSchema);