import express from "express";
import Stripe from "stripe";
import Booking from "../models/Booking.js";

const router = express.Router();

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-06-20" }) : null;

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

async function markPaidByBookingId(bookingId, paymentIntentId) {
  if (!bookingId) return { ok: false, error: "BOOKING_ID_MISSING" };

  const now = new Date();

  const updated = await Booking.findOneAndUpdate(
    { _id: bookingId },
    {
      $set: {
        status: "PAID",
        paidAt: now,
        stripePaymentIntentId: paymentIntentId || null,
      },
    },
    { new: true }
  );

  if (!updated) return { ok: false, error: "BOOKING_NOT_FOUND" };
  return { ok: true, booking: updated };
}

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!stripe) return res.status(500).send("STRIPE_SECRET_KEY_MISSING");
    if (!webhookSecret) return res.status(500).send("STRIPE_WEBHOOK_SECRET_MISSING");

    const sig = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    const type = safeStr(event?.type);

    if (type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const paymentIntentId = safeStr(pi?.id);
      const bookingId = safeStr(pi?.metadata?.bookingId);

      const r = await markPaidByBookingId(bookingId, paymentIntentId);
      if (!r.ok) {
        return res.status(200).send("ok");
      }
      return res.status(200).send("ok");
    }

    return res.status(200).send("ok");
  } catch (e) {
    return res.status(400).send(`webhook error: ${e?.message || e}`);
  }
});

export default router;
