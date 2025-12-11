// models/Guide.js
// Modelo de Guía para I GUIDE U – Backend 24

import mongoose from "mongoose";

const guideSchema = new mongoose.Schema(
  {
    // ID legible (opcional pero útil para URL / slugs)
    id: {
      type: String,
      required: false, // lo generamos si hace falta; en la DB ya estás usando cosas como "arun-bangkok"
      index: true,
      unique: false,
    },

    // Datos básicos visibles para el viajero
    name: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },

    // Rating visible
    rating: {
      type: Number,
      default: 5,
      min: 0,
      max: 5,
    },

    // Precios base
    priceHour: {
      type: Number,
      required: true,
    },
    priceDay: {
      type: Number,
      required: true,
    },

    // Duplicados para compatibilidad / lógica interna (si ya los usabas)
    hourlyRate: {
      type: Number,
    },
    dailyRate: {
      type: Number,
    },

    // Idiomas que habla el guía
    languages: {
      type: [String],
      default: [],
    },

    // Descripción corta para mostrar en cards / detalle
    description: {
      type: String,
      default: "",
      trim: true,
    },

    // ================================
    //  TIPO DE GUÍA / SEGURIDAD
    // ================================

    // Tipo de guía:
    // - OFFICIAL   → guía con título/licencia oficial verificada
    // - INDEPENDENT → guía local / freelance sin título oficial
    guideType: {
      type: String,
      enum: ["OFFICIAL", "INDEPENDENT"],
      default: "INDEPENDENT",
      index: true,
    },

    // Identidad verificada:
    // true  → DNI + selfie / documentos verificados
    // false → aún no verificado
    identityVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    // En el futuro: datos de verificación (proveedor externo)
    verificationProvider: {
      type: String, // "stripe_identity", "persona", "manual", etc.
      default: null,
    },
    verificationAt: {
      type: Date,
      default: null,
    },

    // Campos extra opcionales para futuro
    avatarUrl: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt automáticos
  }
);

// Antes de guardar, si no hay hourlyRate/dailyRate, los clonamos de priceHour/priceDay
guideSchema.pre("save", function (next) {
  if (this.priceHour != null && this.hourlyRate == null) {
    this.hourlyRate = this.priceHour;
  }
  if (this.priceDay != null && this.dailyRate == null) {
    this.dailyRate = this.priceDay;
  }

  // Si no hay id legible, generamos uno simple (por ejemplo arun-bangkok)
  if (!this.id && this.name && this.city) {
    const slugPart = (str) =>
      String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

    this.id = `${slugPart(this.name.split("–")[0] || this.name)}-${slugPart(
      this.city
    )}`;
  }

  next();
});

const Guide = mongoose.model("Guide", guideSchema);

export default Guide;
