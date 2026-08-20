import express from "express";
import mongoose from "mongoose";
import Stripe from "stripe";
import Booking from "../models/Booking.js";
import { recordGuidePaidBooking } from "../services/guide-membership.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey)
  : null;

function pickAmount(body = {}) {
  const raw =
    body.amountCents ??
    body.amount_centavos ??
    body.amount_cent ??
    body.amountUsdCents ??
    body.totalAmountCents ??
    body.total_cents ??
    body.amount ??
    body.amountUsd ??
    body.totalAmount ??
    body.total;

  const n = Number(raw);

  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, amountCents: 0 };
  }

  if (n >= 1000) {
    return { ok: true, amountCents: Math.round(n) };
  }

  return { ok: true, amountCents: Math.round(n * 100) };
}

function isProductionLike() {
  const env = String(process.env.NODE_ENV || "").trim().toLowerCase();
  return env === "production";
}

function authEmail(req) {
  return String(req.user?.email || "").trim().toLowerCase();
}

router.post("/pay-test", requireAuth, async (req, res) => {
  try {
    if (isProductionLike()) {
      return res.status(403).json({ error: "PAY_TEST_DISABLED_IN_PRODUCTION" });
    }

    const bookingId = String(req.body?.bookingId || "").trim();
    const currentUserEmail = authEmail(req);

    if (!currentUserEmail) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }

    if (!bookingId) {
      return res.status(400).json({ error: "BOOKING_ID_REQUIRED" });
    }

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ error: "BOOKING_ID_INVALID" });
    }

    const parsed = pickAmount(req.body);

    if (!parsed.ok) {
      return res.status(400).json({
        error: "AMOUNT_REQUIRED",
        received: req.body || null
      });
    }

    const db = mongoose.connection?.db;

    if (!db) {
      return res.status(500).json({ error: "Mongo not connected" });
    }

    const bookings = db.collection("bookings");
    const bookingObjectId = new mongoose.Types.ObjectId(bookingId);

    const existingBooking = await bookings.findOne({ _id: bookingObjectId });

    if (!existingBooking) {
      return res.status(404).json({ error: "BOOKING_NOT_FOUND" });
    }

    const bookingTravelerEmail = String(existingBooking.travelerEmail || "").trim().toLowerCase();

    if (!bookingTravelerEmail) {
      return res.status(400).json({ error: "BOOKING_TRAVELER_EMAIL_MISSING" });
    }

    if (bookingTravelerEmail !== currentUserEmail) {
      return res.status(403).json({ error: "FORBIDDEN_BOOKING" });
    }

    const amountCents = parsed.amountCents;
    const amountUsd = Number((amountCents / 100).toFixed(2));

    const result = await bookings.findOneAndUpdate(
      { _id: bookingObjectId },
      {
        $set: {
          status: "PAID",
          amount: amountUsd,
          amountUsd,
          amountCents,
          totalAmount: amountUsd,
          paidAt: new Date(),
          paymentMode: "test",
          paymentStatus: "paid"
        }
      },
      { returnDocument: "after" }
    );

    const booking = result?.value || result;

    if (!booking) {
      return res.status(404).json({ error: "BOOKING_NOT_FOUND" });
    }

    const membershipTracking = await recordGuidePaidBooking(booking, "pay-test");

    return res.json({
      ok: true,
      bookingId,
      amountUsd,
      amountCents,
      status: "PAID",
      booking,
      membershipTracking
    });
  } catch (error) {
    return res.status(500).json({
      error: "PAY_TEST_ERROR"
    });
  }
});

router.post("/create-intent", requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: "STRIPE_NOT_CONFIGURED" });
    }

    const bookingId = String(req.body?.bookingId || "").trim();
    const currentUserEmail = authEmail(req);

    if (!currentUserEmail) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }

    if (!bookingId) {
      return res.status(400).json({ error: "BOOKING_ID_REQUIRED" });
    }

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ error: "BOOKING_ID_INVALID" });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ error: "BOOKING_NOT_FOUND" });
    }

    const bookingTravelerEmail = String(booking.travelerEmail || "").trim().toLowerCase();

    if (!bookingTravelerEmail) {
      return res.status(400).json({ error: "BOOKING_TRAVELER_EMAIL_MISSING" });
    }

    if (bookingTravelerEmail !== currentUserEmail) {
      return res.status(403).json({ error: "FORBIDDEN_BOOKING" });
    }

    let amountCents = Number(booking.amountCents || 0);

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({
        error: "INVALID_BOOKING_AMOUNT"
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      payment_method_types: ["card"],
      metadata: {
        bookingId: String(booking._id),
        travelerEmail: bookingTravelerEmail
      }
    });

    booking.amountCents = amountCents;
    booking.amountUsd = Number((amountCents / 100).toFixed(2));
    booking.amount = booking.amountUsd;
    booking.totalAmount = booking.amountUsd;
    booking.paymentMode = "stripe";
    booking.paymentStatus = "pending";
    booking.stripePaymentIntentId = paymentIntent.id;
    await booking.save();

    return res.json({
      ok: true,
      bookingId: String(booking._id),
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amountCents,
      amountUsd: booking.amountUsd,
      status: String(booking.status || "PENDING")
    });
  } catch (error) {
    return res.status(500).json({
      error: "CREATE_INTENT_ERROR"
    });
  }
});

export default router;
