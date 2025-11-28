const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    guideName: { type: String, required: true },        // por ahora demo/simple
    travelerEmail: { type: String, required: true },    // email del viajero
    amountTotal: { type: Number, required: true },      // total en centavos Stripe
    platformFee: { type: Number, required: true },      // 10% plataforma
    guideAmount: { type: Number, required: true },      // 90% guía
    currency: { type: String, default: "usd" },
    stripeSessionId: { type: String, required: true },
    status: { type: String, default: "paid" },          // paid / refunded / etc.
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = mongoose.model("Booking", bookingSchema);
