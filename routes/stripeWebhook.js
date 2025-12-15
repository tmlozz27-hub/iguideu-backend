import express from "express";
import Stripe from "stripe";
import Booking from "../models/Booking.js";

const router = express.Router();

async function handler(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(500).send("STRIPE_WEBHOOK_SECRET missing");

  let event;
  try {
    const sig = req.headers["stripe-signature"];
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error("❌ webhook signature failed:", err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || "invalid signature"}`);
  }

  try {
    console.log("🔔 webhook event:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookingId = session?.metadata?.bookingId;

      console.log("🧾 session.id:", session?.id, "bookingId:", bookingId);

      if (bookingId) {
        await Booking.findByIdAndUpdate(
          bookingId,
          {
            paymentStatus: "paid",
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: session.payment_intent || undefined,
          },
          { new: true }
        );
        console.log("✅ PAID booking:", bookingId);
      } else {
        console.log("⚠️ session sin bookingId en metadata");
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("❌ webhook handler error:", err);
    return res.status(500).send("Webhook handler failed");
  }
}

// ✅ acepta ambos paths: /api/webhooks/stripe  y /api/webhooks/stripe/stripe
router.post("/", handler);
router.post("/stripe", handler);

export default router;
