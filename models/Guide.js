import mongoose from "mongoose";

const guideSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    hourlyRate: { type: Number, required: true },
    dailyRate: { type: Number, required: true },
    rating: { type: Number, default: 5.0 },
    languages: [{ type: String }],
    description: { type: String },
    photo: { type: String }
  },
  {
    timestamps: true
  }
);

const Guide = mongoose.model("Guide", guideSchema);

export default Guide;
