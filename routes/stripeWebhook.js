// routes/stripeWebhook.js (ESM)
// Webhook Stripe: valida firma y marca booking como "paid" cuando corresponde.

import express from "express";
import Stripe from "stripe";
import Booking from "../models/Booking.js";

const router = express.Router();

// Stripe webhook necesita RAW body para validar firma
router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secretKey) return res.status(500).send("Missing STRIPE_SECRET_KEY");
    if (!webhookSecret) return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");

    const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

    const sig = req.headers["stripe-signature"];
    if (!sig) return res.status(400).send("Missing stripe-signature");

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    }

    // Eventos más comunes para “pago confirmado”
    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;

      const bookingId = session?.metadata?.bookingId;
      const paymentStatus = String(session?.payment_status || "").toLowerCase();

      if (bookingId) {
        const booking = await Booking.findById(bookingId);
        if (booking) {
          if (paymentStatus === "paid") booking.paymentStatus = "paid";
          booking.stripeCheckoutSessionId = session.id;
          booking.updatedAt = new Date();
          await booking.save();
        }
      }
    }

    // Responder 200 SIEMPRE si lo procesaste
    return res.json({ received: true, type: event.type });
  } catch (e) {
    return res.status(500).send(`Webhook error: ${String(e?.message || e)}`);
  }
});

export default router;
