import express from "express";
import Stripe from "stripe";
import Booking from "../models/Booking.js";

const router = express.Router();

/* ===========================
   HEALTH
=========================== */

router.get("/health", (req, res) => {
  res.json({ ok: true, payments: true });
});

router.get("/", (req, res) => {
  res.json({ ok: true, route: "/api/payments" });
});

/* ===========================
   STRIPE INIT
=========================== */

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: "2024-06-20" })
  : null;

/* ===========================
   CREATE PAYMENT INTENT
=========================== */

router.post("/create-intent", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: "STRIPE_SECRET_KEY_MISSING" });
    }

    const amount = Number(req.body?.amount || 0);
    const currency = String(req.body?.currency || "usd").toLowerCase();
    const bookingId = String(req.body?.bookingId || "");

    if (!amount || amount < 50) {
      return res.status(400).json({ error: "INVALID_AMOUNT" });
    }

    if (!bookingId) {
      return res.status(400).json({ error: "BOOKING_ID_MISSING" });
    }

    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        bookingId,
      },
      automatic_payment_methods: { enabled: true },
    });

    return res.status(200).json({
      ok: true,
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret,
    });
  } catch (e) {
    return res.status(500).json({
      error: "CREATE_INTENT_ERROR",
      message: e?.message || e,
    });
  }
});

/* ===========================
   STAGING FORCE CONFIRM
=========================== */

router.post("/confirm-test", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ ok: false, error: "STRIPE_NOT_READY" });
    }

    const { paymentIntentId, bookingId } = req.body;

    if (!paymentIntentId || !bookingId) {
      return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });
    }

    await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: "pm_card_visa",
    });

    const updated = await Booking.findByIdAndUpdate(
      bookingId,
      {
        status: "PAID",
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
      },
      { new: true }
    );

    return res.status(200).json({
      ok: true,
      booking: updated,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "CONFIRM_ERROR",
      message: e?.message || e,
    });
  }
});

export default router;


