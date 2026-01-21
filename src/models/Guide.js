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
  },
  { timestamps: true }
);

// evita recompilar modelo en hot reload
export default mongoose.models.Guide || mongoose.model("Guide", GuideSchema);
