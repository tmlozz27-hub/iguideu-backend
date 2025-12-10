import mongoose from "mongoose";

const guideSchema = new mongoose.Schema(
  {
    // Código interno opcional (g1001, g1002, etc.)
    code: { type: String },

    // Datos básicos
    name: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },

    // Tarifas principales (definidas libremente por cada guía)

    // USD por hora (1 a 7 hs, y horas extra 9 a 11 hs o 9 a 12 hs si no hay promo)
    hourlyRate: { type: Number, required: true },

    // USD por día de 8 horas (puede ser promo 8h vs 8 × hourlyRate)
    dailyRate: { type: Number, required: true },

    // USD por 12 horas promo (OPCIONAL).
    // Si el guía quiere ofrecer un precio especial por 12h más barato que el cálculo normal,
    // lo pone acá. Si está vacío, se calcula como day + extras.
    promo12hRate: { type: Number },

    // USD por FULL DAY 24h (13 a 24 hs).
    // Si no se define, se calcula automáticamente (ej: 2 × dailyRate).
    fullDay24hRate: { type: Number },

    // Otros datos
    rating: { type: Number, default: 0 },
    languages: [{ type: String }],
    description: { type: String },

    // Para desactivar un guía sin borrarlo
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Reutiliza el modelo si ya existe (para hot reload, etc.)
const Guide =
  mongoose.models.Guide || mongoose.model("Guide", guideSchema);

export default Guide;
