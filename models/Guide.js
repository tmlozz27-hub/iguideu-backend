import mongoose from "mongoose";

const GuideSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    title: { type: String, default: "" },
    city: { type: String, required: true },
    country: { type: String, required: true },

    languages: { type: [String], default: [] },

    pricePerHourUsd: { type: Number, default: 0 },
    pricePerDayUsd: { type: Number, default: 0 },

    // Opcional (para “cercanos” real en el futuro)
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Guide", GuideSchema);
