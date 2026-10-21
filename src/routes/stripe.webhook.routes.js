import express from "express";
import mongoose from "mongoose";
import Stripe from "stripe";
import { recordGuidePaidBooking } from "../services/guide-membership.js";

const router = express.Router();
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

async function loadBookingModel() {
  try {
    const mod = await import("../models/Booking.js");
    return mod.default || mod.Booking || null;
  } catch { return null; }
}

router.post("/webhook", async (req, res) => {
  try {
    if (!stripe) return res.status(500).send("stripe_not_configured");
    if (!STRIPE_WEBHOOK_SECRET) return res.status(500).send("webhook_secret_missing");
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET);
    } catch {
      return res.status(400).send("signature_verification_failed");
    }
    const type = String(event?.type || "");
    console.log(new Date().toISOString(), "WEBHOOK", type);
    if (type !== "payment_intent.succeeded") return res.status(200).json({ received: true, type });

    const Booking = await loadBookingModel();
    if (!Booking) return res.status(500).json({ received: false, error: "BOOKING_MODEL_UNAVAILABLE" });
    const obj = event?.data?.object || {};
    const paymentIntentId = String(obj.id || "");
    const bookingId = String(obj.metadata?.bookingId || "");
    let booking = null;
    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) booking = await Booking.findById(bookingId);
    if (!booking && paymentIntentId) booking = await Booking.findOne({ stripePaymentIntentId: paymentIntentId });
    if (!booking) return res.status(500).json({ received: false, error: "BOOKING_NOT_FOUND" });

    const expectedPaymentIntentId = String(booking.stripePaymentIntentId || "").trim();
    const expectedAmountCents = Number(booking.amountCents || 0);
    const expectedCurrency = String(booking.currency || "usd").trim().toLowerCase();
    const receivedAmountCents = Number(obj.amount_received || 0);
    const receivedCurrency = String(obj.currency || "").trim().toLowerCase();
    if (!expectedPaymentIntentId || expectedPaymentIntentId !== paymentIntentId) {
      return res.status(400).json({ received: false, error: "PAYMENT_INTENT_MISMATCH" });
    }
    if (!Number.isFinite(expectedAmountCents) || expectedAmountCents <= 0 || receivedAmountCents !== expectedAmountCents) {
      return res.status(400).json({ received: false, error: "AMOUNT_MISMATCH" });
    }
    if (!receivedCurrency || receivedCurrency !== expectedCurrency) {
      return res.status(400).json({ received: false, error: "CURRENCY_MISMATCH" });
    }

    if (!["PAID", "COMPLETED"].includes(booking.status)) {
      // Use the stored currency as-is: validation above already compares normalized values.
      const updated = await Booking.findOneAndUpdate(
        {
          _id: booking._id,
          stripePaymentIntentId: paymentIntentId,
          amountCents: expectedAmountCents,
          currency: booking.currency,
          status: { $in: ["PENDING", "CONFIRMED"] },
          paidAt: null
        },
        { $set: {
          status: "PAID",
          paidAt: new Date(),
          guidePayoutAmountCents: Math.round(expectedAmountCents * 0.9),
          guidePayoutStatus: "NOT_READY"
        } },
        { new: true }
      );
      if (!updated) {
        // A simultaneous webhook may have won, or the booking may be ineligible.
        booking = await Booking.findById(booking._id);
        if (!booking || !["PAID", "COMPLETED"].includes(booking.status) || !booking.paidAt) {
          return res.status(409).json({ received: false, error: "BOOKING_NOT_ELIGIBLE" });
        }
      } else {
        booking = updated;
      }
    }
    if (!["PAID", "COMPLETED"].includes(booking.status) || !booking.paidAt) {
      return res.status(409).json({ received: false, error: "BOOKING_NOT_PAID" });
    }
    const tracking = await recordGuidePaidBooking(booking, "stripe-webhook");
    if (!tracking.ok) {
      console.error("MEMBERSHIP_TRACKING_FAILED", tracking.reason);
      return res.status(500).json({ received: false, error: "MEMBERSHIP_TRACKING_FAILED" });
    }
    return res.status(200).json({ received: true, type, alreadyTracked: Boolean(tracking.skipped) });
  } catch (err) {
    console.error(new Date().toISOString(), "WEBHOOK ERROR", err?.message || "unknown");
    return res.status(500).send("webhook_error");
  }
});

export default router;
