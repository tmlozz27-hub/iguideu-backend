// routes/stripe.js
// Webhook oficial de Stripe para actualizar bookings automáticamente

const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const Booking = require("../models/Booking");

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  console.warn("[stripe.js] ⚠️ Falta STRIPE_SECRET_KEY en el .env");
}
if (!stripeWebhookSecret) {
  console.warn("[stripe.js] ⚠️ Falta STRIPE_WEBHOOK_SECRET en el .env");
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// Middleware especial de Stripe (NO usar express.json aquí)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      if (!stripe || !stripeWebhookSecret) {
        console.error("[stripe.js] ❌ Webhook no configurado en .env");
        return res.status(500).send("Webhook no configurado");
      }

      const sig = req.headers["stripe-signature"];
      let event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          stripeWebhookSecret
        );
      } catch (err) {
        console.error("[stripe.js] ❌ Error verificando firma del webhook:", err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // =============================
      // EVENTO: checkout.session.completed
      // =============================
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        console.log(
          "[stripe.js] 💳 Pago completado:",
          session.id,
          "estado:",
          session.payment_status
        );

        if (session.payment_status === "paid") {
          // Buscar el booking creado por create-checkout
          const booking = await Booking.findOne({
            stripeSessionId: session.id,
          });

          if (!booking) {
            console.warn(
              "[stripe.js] ⚠️ No encontré booking para session.id:",
              session.id
            );
          } else {
            // Actualizar booking a pago completado
            booking.status = "paid";

            // Si todavía no están las comisiones (puede pasar)
            if (
              typeof booking.platformFee !== "number" ||
              typeof booking.guideAmount !== "number"
            ) {
              booking.platformFee = Math.round(booking.amount * 0.1);
              booking.guideAmount = booking.amount - booking.platformFee;
            }

            await booking.save();

            console.log(
              "[stripe.js] ✅ Booking actualizado a PAID:",
              booking._id
            );
          }
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("[stripe.js] ❌ Error procesando webhook:", err);
      res.status(500).send("Webhook handler failed");
    }
  }
);

module.exports = router;
