// models/Guide.cjs – modelo de guía en CommonJS

const mongoose = require("mongoose");

const guideSchema = new mongoose.Schema(
  {
    code: { type: String }, // opcional, por si usás g1001, etc.
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

const Guide =
  mongoose.models.Guide || mongoose.model("Guide", guideSchema);

module.exports = Guide;
