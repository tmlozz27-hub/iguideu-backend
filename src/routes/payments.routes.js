import express from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
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

router.post("/pay-test", requireAuth, (_req, res) => {
  return res.status(403).json({
    error: "PAY_TEST_PERMANENTLY_DISABLED"
  });
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

    const bookingStatus = String(booking.status || "").toUpperCase();
    const paymentStatus = String(booking.paymentStatus || "").toLowerCase();

    if (
      ["PAID", "COMPLETED", "CANCELLED"].includes(bookingStatus) ||
      ["paid", "succeeded", "refunded"].includes(paymentStatus)
    ) {
      return res.status(409).json({ error: "BOOKING_NOT_PAYABLE" });
    }

    let amountCents = Number(booking.amountCents || 0);

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({
        error: "INVALID_BOOKING_AMOUNT"
      });
    }

    const existingIntentId = String(booking.stripePaymentIntentId || "").trim();

    if (existingIntentId) {
      const existingIntent = await stripe.paymentIntents.retrieve(existingIntentId);
      if (
        String(existingIntent.metadata?.bookingId || "") !== String(booking._id) ||
        Number(existingIntent.amount) !== amountCents ||
        String(existingIntent.currency).toLowerCase() !== "usd"
      ) {
        return res.status(409).json({ error: "EXISTING_PAYMENT_MISMATCH" });
      }
      if (
        ["requires_payment_method", "requires_confirmation", "requires_action"].includes(existingIntent.status) &&
        existingIntent.client_secret
      ) {
        return res.json({
          ok: true,
          bookingId: String(booking._id),
          paymentIntentId: existingIntent.id,
          clientSecret: existingIntent.client_secret,
          amountCents,
          amountUsd: Number((amountCents / 100).toFixed(2)),
          status: String(booking.status || "PENDING")
        });
      }
      return res.status(409).json({ error: "EXISTING_PAYMENT_NOT_REUSABLE" });
    }

    // Claim the booking atomically BEFORE calling Stripe. The claim is deliberately
    // NOT automatically expired: after a timeout/crash Stripe may have created an
    // intent, and retrying with a new idempotency window could double-charge.
    const lock = randomUUID();
    const claimed = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        travelerEmail: booking.travelerEmail,
        amountCents,
        status: { $nin: ["PAID", "COMPLETED", "CANCELLED"] },
        paymentStatus: { $nin: ["paid", "succeeded", "refunded"] },
        cancellationLock: { $in: ["", null] },
        cancellationRefundStatus: { $in: ["NOT_STARTED", null] },
        $and: [
          { $or: [{ stripePaymentIntentId: "" }, { stripePaymentIntentId: null }, { stripePaymentIntentId: { $exists: false } }] },
          { $or: [{ paymentIntentCreationLock: "" }, { paymentIntentCreationLock: null }, { paymentIntentCreationLock: { $exists: false } }] }
        ]
      },
      { $set: { paymentIntentCreationLock: lock, paymentIntentCreationLockExpiresAt: null } },
      { new: true }
    );
    if (!claimed) {
      // Another request may have completed its claim: caller can retry to reuse
      // the persisted intent; never create a second one here.
      return res.status(409).json({ error: "PAYMENT_CREATION_IN_PROGRESS_OR_RECONCILIATION_REQUIRED" });
    }

    // Persist the same idempotency key across attempts; never automatically
    // clear an uncertain claim, including on Stripe timeout or Mongo failure.
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        payment_method_types: ["card"],
        metadata: {
          bookingId: String(booking._id),
          travelerEmail: bookingTravelerEmail
        }
      }, { idempotencyKey: `iguideu-booking-${booking._id}-amount-${amountCents}` });
    } catch (_stripeError) {
      return res.status(503).json({ error: "PAYMENT_CREATION_RECONCILIATION_REQUIRED" });
    }

    const amountUsd = Number((amountCents / 100).toFixed(2));
    const persisted = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        paymentIntentCreationLock: lock,
        status: { $nin: ["PAID", "COMPLETED", "CANCELLED"] },
        $or: [{ stripePaymentIntentId: "" }, { stripePaymentIntentId: null }, { stripePaymentIntentId: { $exists: false } }]
      },
      {
        $set: {
          amountCents,
          amountUsd,
          amount: amountUsd,
          totalAmount: amountUsd,
          paymentMode: "stripe",
          paymentStatus: "pending",
          stripePaymentIntentId: paymentIntent.id,
          paymentIntentCreationLock: "",
          paymentIntentCreationLockExpiresAt: null
        }
      },
      { new: true }
    );
    if (!persisted) {
      return res.status(409).json({ error: "PAYMENT_CREATION_RECONCILIATION_REQUIRED" });
    }

    return res.json({
      ok: true,
      bookingId: String(booking._id),
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amountCents,
      amountUsd: persisted.amountUsd,
      status: String(persisted.status || "PENDING")
    });
  } catch (error) {
    return res.status(500).json({
      error: "CREATE_INTENT_ERROR"
    });
  }
});

export default router;
