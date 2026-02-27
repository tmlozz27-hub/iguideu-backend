import express from "express";
import Stripe from "stripe";
import { getModels } from "../services/mongo.js";

const router = express.Router();

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" })
  : null;

/*
DEBUG STRIPE ACCOUNT
*/
router.get("/debug-stripe", async (req, res) => {
  try {
    if (!stripe)
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY_MISSING" });

    const acct = await stripe.accounts.retrieve();
    return res.json({
      ok: true,
      stripeAccountId: acct.id,
      email: acct.email || null,
      country: acct.country || null,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message });
  }
});

/*
CREATE INTENT + CREATE PAYMENT RECORD
*/
router.post("/create-intent", async (req, res) => {
  try {
    if (!stripe)
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY_MISSING" });

    const { Booking, Payment } = getModels();

    const amount = Number(req.body?.amount || 0);
    const currency = String(req.body?.currency || "usd").toLowerCase();
    const bookingId = String(req.body?.bookingId || "");

    if (!amount || amount < 50)
      return res.status(400).json({ ok: false, error: "INVALID_AMOUNT" });

    if (!bookingId)
      return res.status(400).json({ ok: false, error: "BOOKING_ID_REQUIRED" });

    const booking = await Booking.findById(bookingId);
    if (!booking)
      return res.status(404).json({ ok: false, error: "BOOKING_NOT_FOUND" });

    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: { bookingId },
      automatic_payment_methods: { enabled: true },
    });

    const platformFeePercent = 10;
    const platformFeeAmount = Math.round((amount * platformFeePercent) / 100);
    const guideNetAmount = amount - platformFeeAmount;

    const payment = await Payment.create({
      email: booking.email,
      bookingId: booking._id,
      amount,
      currency,
      status: "created",
      stripePaymentIntentId: pi.id,
      platformFeePercent,
      platformFeeAmount,
      guideNetAmount,
    });

    await Booking.findByIdAndUpdate(booking._id, {
      stripePaymentIntentId: pi.id,
      totalAmount: amount,
      currency,
      paymentStatus: "unpaid",
    });

    return res.json({
      ok: true,
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret,
      paymentId: payment._id,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message,
      type: e?.type,
      code: e?.code,
    });
  }
});

export default router;