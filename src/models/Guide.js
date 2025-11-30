// src/models/Guide.js
import mongoose from "mongoose";

const GuideSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    slug: { type: String },

    city: { type: String, required: true },
    country: { type: String, required: true },
    countryCode: { type: String },

    hourlyRate: { type: Number, required: true },
    dailyRate: { type: Number, required: true },

    rating: { type: Number, default: 5 },

    languages: [{ type: String }],

    shortDescription: { type: String },
    description: { type: String },

    tags: [{ type: String }],

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

const Guide = mongoose.model("Guide", GuideSchema);
export default Guide;
