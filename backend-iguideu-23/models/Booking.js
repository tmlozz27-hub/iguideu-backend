// models/Booking.js
// Modelo de reservas de I GUIDE U

const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    // ID del viajero (luego lo ligamos a auth/JWT)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // lo podemos hacer required true cuando definamos bien auth
    },

    // ID del guía reservado
    guideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guide",
      required: false, // idem arriba
    },

    // Datos básicos de la reserva
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String, // ej: "09:00"
      required: false,
    },
    hours: {
      type: Number,
      required: false,
      min: 1,
    },

    // Monto y moneda
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "usd",
      uppercase: true,
    },

    // Estado de la reserva
    status: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
      default: "pending",
    },

    // Stripe
    stripeSessionId: {
      type: String,
      required: false,
      index: true,
      unique: false, // más adelante podemos reforzar esto
    },
    stripePaymentIntentId: {
      type: String,
      required: false,
      index: true,
    },

    // Datos extra (nombre guía, ciudad, etc.) para no depender solo de IDs
    guideName: {
      type: String,
      required: false,
      trim: true,
    },
    city: {
      type: String,
      required: false,
      trim: true,
    },
    country: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Un índice útil para buscar por usuario y fecha
bookingSchema.index({ userId: 1, date: 1 });

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;
