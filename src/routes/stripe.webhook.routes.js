import express from "express";
import mongoose from "mongoose";
import Stripe from "stripe";
import { recordGuidePaidBooking } from "../services/guide-membership.js";

const router = express.Router();

const STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET ||
  "";

const STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET ||
  "";

let stripe = null;

if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY);
}

async function loadBookingModel() {
  try {
    const mod = await import("../models/Booking.js");
    return mod.default || mod.Booking || null;
  } catch {
    return null;
  }
}

router.post("/webhook", async (req, res) => {
  try {
    if (!stripe) return res.status(500).send("stripe_not_configured");
    if (!STRIPE_WEBHOOK_SECRET) return res.status(500).send("webhook_secret_missing");

    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );
    } catch {
      return res.status(400).send("signature_verification_failed");
    }

    const type = event?.type ? String(event.type) : "";
    const obj = event?.data?.object || {};
    const paymentIntentId = obj?.id ? String(obj.id) : "";
    const bookingId = obj?.metadata?.bookingId ? String(obj.metadata.bookingId) : "";

    console.log(
      new Date().toISOString(),
      "WEBHOOK",
      type,
      "pi=",
      paymentIntentId,
      "bookingId=",
      bookingId
    );

    if (type === "payment_intent.succeeded") {
      const Booking = await loadBookingModel();

      if (!Booking) {
        console.log("BOOKING MODEL NOT LOADED");
        return res.status(200).json({ received: true });
      }

      let booking = null;

      if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
        booking = await Booking.findById(bookingId);
      }

      if (!booking && paymentIntentId) {
        booking = await Booking.findOne({
          stripePaymentIntentId: paymentIntentId
        });
      }

      if (!booking) {
        console.log(
          "NO BOOKING FOUND FOR EVENT",
          paymentIntentId,
          bookingId
        );
      } else {
        const expectedPaymentIntentId = String(booking.stripePaymentIntentId || "").trim();
        const expectedAmountCents = Number(booking.amountCents || 0);
        const expectedCurrency = String(booking.currency || "usd").trim().toLowerCase();
        const receivedAmountCents = Number(obj?.amount_received || 0);
        const receivedCurrency = String(obj?.currency || "").trim().toLowerCase();

        if (!expectedPaymentIntentId || expectedPaymentIntentId !== paymentIntentId) {
          console.log("WEBHOOK_PAYMENT_INTENT_MISMATCH", String(booking._id), paymentIntentId);
          return res.status(400).json({ received: false, error: "PAYMENT_INTENT_MISMATCH" });
        }

        if (!Number.isFinite(expectedAmountCents) || expectedAmountCents <= 0 || receivedAmountCents !== expectedAmountCents) {
          console.log("WEBHOOK_AMOUNT_MISMATCH", String(booking._id), receivedAmountCents);
          return res.status(400).json({ received: false, error: "AMOUNT_MISMATCH" });
        }

        if (!receivedCurrency || receivedCurrency !== expectedCurrency) {
          console.log("WEBHOOK_CURRENCY_MISMATCH", String(booking._id), receivedCurrency);
          return res.status(400).json({ received: false, error: "CURRENCY_MISMATCH" });
        }

        booking.status = "PAID";
        booking.stripePaymentIntentId = paymentIntentId || booking.stripePaymentIntentId;
        booking.paidAt = new Date();

        await booking.save({ validateBeforeSave: false });

        const membershipTracking = await recordGuidePaidBooking(booking, "stripe-webhook");

        console.log(
          "BOOKING UPDATED TO PAID",
          String(booking._id),
          paymentIntentId,
          "membershipTracking=",
          JSON.stringify(membershipTracking)
        );
      }
    }

    return res.status(200).json({
      received: true,
      type
    });
  } catch (err) {
    console.log(
      new Date().toISOString(),
      "WEBHOOK ERROR",
      err?.message || "unknown"
    );

    return res.status(500).send("webhook_error");
  }
});

export default router;