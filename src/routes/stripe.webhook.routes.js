import express from "express";
import Stripe from "stripe";

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

let stripe = null;
if (STRIPE_SECRET_KEY) stripe = new Stripe(STRIPE_SECRET_KEY);

async function markBookingPaid(bookingId, paymentIntentId) {
  if (!bookingId) return;

  let Booking = null;
  try {
    const mod = await import("../models/Booking.js");
    Booking = mod.default || mod.Booking || null;
  } catch {
    Booking = null;
  }

  if (!Booking) return;

  await Booking.findByIdAndUpdate(
    bookingId,
    {
      $set: {
        status: "PAID",
        stripePaymentIntentId: paymentIntentId || "",
        paidAt: new Date().toISOString(),
      },
    },
    { new: false }
  );
}

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!stripe) return res.status(500).send("stripe_not_configured");
    if (!STRIPE_WEBHOOK_SECRET) return res.status(500).send("webhook_secret_missing");

    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch {
      return res.status(400).send("signature_verification_failed");
    }

    const type = event?.type ? String(event.type) : "";
    const obj = event?.data?.object || {};
    const piId = obj?.id ? String(obj.id) : "";
    const bookingId = obj?.metadata?.bookingId ? String(obj.metadata.bookingId) : "";

    console.log(new Date().toISOString(), "WEBHOOK /api/stripe/webhook type=", type, "pi=", piId, "bookingId=", bookingId);

    if (type === "payment_intent.succeeded") {
      if (bookingId) {
        await markBookingPaid(bookingId, piId);
        console.log(new Date().toISOString(), "BOOKING MARKED PAID", bookingId, piId);
      } else {
        console.log(new Date().toISOString(), "NO bookingId IN METADATA");
      }
    }

    return res.status(200).json({ received: true, type });
  } catch {
    return res.status(500).send("webhook_error");
  }
});

export default router;