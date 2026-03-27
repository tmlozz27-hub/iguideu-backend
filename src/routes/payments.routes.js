import express from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🔥 Booking model (mismo que bookings.routes)
const Booking =
  mongoose.models.Booking ||
  mongoose.model(
    "Booking",
    new mongoose.Schema({}, { strict: false }),
    "bookings"
  );

// 🔴 CREATE PAYMENT INTENT
router.post("/create-intent", requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.body || {};

    if (!bookingId) {
      return res.status(400).json({ error: "bookingId required" });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ error: "BOOKING_NOT_FOUND" });
    }

    // 🔥 FIX REAL — usar TODOS los campos posibles
    const amountCents =
      booking.amountCents ||
      Math.round(
        Number(
          booking.total ||
          booking.price ||
          booking.totalAmount ||
          booking.amount ||
          0
        ) * 100
      );

    if (!amountCents || amountCents <= 0) {
      return res.status(400).json({ error: "AMOUNT_REQUIRED" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: booking.currency || "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        bookingId: String(booking._id),
      },
    });

    return res.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error("CREATE_INTENT_ERROR", err);
    return res.status(500).json({
      error: "CREATE_INTENT_FAILED",
      detail: err?.message || "Internal error",
    });
  }
});

// 🔴 HEALTH
router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

export default router;