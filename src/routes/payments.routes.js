import express from "express";
import mongoose from "mongoose";
import { recordGuidePaidBooking } from "../services/guide-membership.js";

const router = express.Router();

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

router.post("/pay-test", async (req, res) => {
  try {
    if (isProductionLike()) {
      return res.status(403).json({ error: "PAY_TEST_DISABLED_IN_PRODUCTION" });
    }

    const bookingId = String(req.body?.bookingId || "").trim();

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
    const amountCents = parsed.amountCents;
    const amountUsd = Number((amountCents / 100).toFixed(2));

    const result = await bookings.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(bookingId) },
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
      error: error?.message || "PAY_TEST_ERROR"
    });
  }
});

export default router;