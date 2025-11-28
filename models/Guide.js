import mongoose from "mongoose";

const guideSchema = new mongoose.Schema(
  {
    // Código interno opcional, por si en el futuro usás g1001, g1002, etc.
    code: { type: String },

    name: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },

    hourlyRate: { type: Number, required: true },
    dailyRate: { type: Number, required: true },

    rating: { type: Number, default: 0 },
    languages: [{ type: String }],

    description: { type: String },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Reutiliza el modelo si ya existe (por hot reload, etc.)
const Guide =
  mongoose.models.Guide || mongoose.model("Guide", guideSchema);

export default Guide;
