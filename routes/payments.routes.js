// routes/payments.js (ESM)

import express from "express";
import Stripe from "stripe";
import Booking from "../models/Booking.js";

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ ok: true, payments: true });
});

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

function bookingAmountUsd(b) {
  const t = Number(b.totalUsd ?? b.total ?? 0);
  if (Number.isFinite(t) && t > 0) return t;

  const hours = Number(b.hours ?? 0);
  if (Number.isFinite(hours) && hours > 0) return hours * 18;

  return 10;
}

// ===== POST /api/payments/checkout =====
router.post("/checkout", async (req, res) => {
  try {
    const { bookingId } = req.body || {};
    if (!bookingId) {
      return res.status(400).json({ ok: false, error: "bookingId requerido" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ ok: false, error: "booking no encontrada" });
    }

    const stripe = getStripe();
    const amountUsd = bookingAmountUsd(booking);
    const amountCents = Math.round(amountUsd * 100);

    const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:4020";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment/cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: booking.guideName || "IGUIDEU Booking",
              description: `${booking.city || ""}${
                booking.country ? " · " + booking.country : ""
              }`.trim(),
            },
          },
        },
      ],
      metadata: { bookingId: String(booking._id) },
    });

    booking.stripeCheckoutSessionId = session.id;
    await booking.save();

    return res.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "error creando checkout",
      details: String(e?.message || e),
    });
  }
});

// ===== GET /api/payments/sync/:sessionId =====
router.get("/sync/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentStatus = String(session.payment_status || "").toLowerCase();

    const bookingId = session.metadata?.bookingId;
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (booking) {
        if (paymentStatus === "paid") booking.paymentStatus = "paid";
        booking.stripeCheckoutSessionId = session.id;
        await booking.save();
      }
    }

    return res.json({
      ok: true,
      sessionId: session.id,
      payment_status: session.payment_status,
      bookingId: bookingId || null,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "error sync",
      details: String(e?.message || e),
    });
  }
});

export default router;
