// models/Booking.js
// Versión alineada con server.js (Backend 24)
// - ya no exige total ni guideName obligatorios
// - paymentStatus permite "pending"

import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    // Referencia al guía
    guide: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guide",
      required: true,
    },

    // Nombre del guía (opcional, se puede copiar desde Guide.name)
    guideName: {
      type: String,
    },

    // Datos del viajero
    travelerName: {
      type: String,
      required: true,
    },
    travelerEmail: {
      type: String,
      required: true,
    },

    // Info del viaje
    travelDate: {
      type: Date,
    },
    hours: {
      type: Number,
      required: true,
    },
    durationType: {
      type: String,
      required: true, // HOURS, DAY_8H, PROMO_12H, FULL_DAY_24H, etc.
    },

    // Desglose de precios calculado por calculateBookingPrice
    priceBreakdown: {
      type: Object,
    },

    // Precios (la moneda principal es USD)
    amountUsd: {
      type: Number,
      required: true, // total a cobrar en Stripe
    },
    platformFeeUsd: {
      type: Number,
      required: true, // 10% para I GUIDE U u otro valor
    },
    guideAmountUsd: {
      type: Number,
      required: true, // monto para el guía
    },

    // Campo legacy opcional, por si algún código viejo esperaba "total"
    total: {
      type: Number,
    },

    // Datos de Stripe
    stripeCheckoutSessionId: {
      type: String,
    },
    stripePaymentStatus: {
      type: String,
    },
    stripeCustomerEmail: {
      type: String,
    },
    stripeCheckoutCompletedAt: {
      type: Date,
    },

    // Estado del pago / reserva
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "canceled"],
      default: "pending",
    },

    // Origen de la reserva (checkout, admin, etc.)
    origin: {
      type: String,
      default: "checkout",
    },

    // Notas del viajero / internas
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

export default Booking;
