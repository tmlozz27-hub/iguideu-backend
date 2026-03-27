import express from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const stripeSecretKey =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET_KEY_LIVE ||
  "";

if (!stripeSecretKey) {
  console.error("STRIPE_SECRET_KEY_MISSING");
}

const stripe = new Stripe(stripeSecretKey);

const Booking =
  mongoose.models.Booking ||
  mongoose.model(
    "Booking",
    new mongoose.Schema({}, { strict: false }),
    "bookings"
  );

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function resolveAmountCents(booking) {
  const directCents = [
    booking?.amountCents,
    booking?.totalAmountCents,
    booking?.totalCents,
    booking?.priceCents,
  ]
    .map(toNumber)
    .find((n) => n > 0);

  if (directCents) {
    return Math.round(directCents);
  }

  const majorAmount = [
    booking?.amount,
    booking?.totalAmount,
    booking?.total,
    booking?.price,
  ]
    .map(toNumber)
    .find((n) => n > 0);

  if (majorAmount) {
    return Math.round(majorAmount * 100);
  }

  return 0;
}

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

    const amountCents = resolveAmountCents(booking);
    const currency = String(booking?.currency || "usd").toLowerCase();

    console.log("CREATE_INTENT_BOOKING_DEBUG", {
      bookingId: String(booking._id),
      travelerEmail: booking?.travelerEmail || null,
      amount: booking?.amount ?? null,
      totalAmount: booking?.totalAmount ?? null,
      total: booking?.total ?? null,
      amountCents: booking?.amountCents ?? null,
      totalAmountCents: booking?.totalAmountCents ?? null,
      totalCents: booking?.totalCents ?? null,
      resolvedAmountCents: amountCents,
      currency,
    });

    if (!amountCents || amountCents <= 0) {
      return res.status(400).json({
        error: "AMOUNT_REQUIRED",
        debug: {
          amount: booking?.amount ?? null,
          totalAmount: booking?.totalAmount ?? null,
          total: booking?.total ?? null,
          amountCents: booking?.amountCents ?? null,
          totalAmountCents: booking?.totalAmountCents ?? null,
          totalCents: booking?.totalCents ?? null,
        },
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        bookingId: String(booking._id),
      },
    });

    return res.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amountCents,
      currency,
    });
  } catch (err) {
    console.error("CREATE_INTENT_ERROR", {
      message: err?.message || "Unknown error",
      type: err?.type || null,
      code: err?.code || null,
      rawType: err?.rawType || null,
      statusCode: err?.statusCode || null,
    });

    return res.status(500).json({
      error: "CREATE_INTENT_FAILED",
      detail: err?.message || "Internal error",
      type: err?.type || null,
      code: err?.code || null,
    });
  }
});

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    stripeConfigured: Boolean(stripeSecretKey),
  });
});

export default router;