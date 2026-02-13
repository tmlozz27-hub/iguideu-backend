import express from "express";
import Stripe from "stripe";
import Booking from "../models/Booking.js";

const router = express.Router();

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-06-20" }) : null;

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

async function markPaidByBookingId(bookingId, paymentIntentId) {
  if (!bookingId) return { ok: false, error: "BOOKING_ID_MISSING" };

  const now = new Date();

  const updated = await Booking.findOneAndUpdate(
    { _id: bookingId },
    {
      $set: {
        status: "PAID",
        paidAt: now,
        stripePaymentIntentId: paymentIntentId || null,
      },
    },
    { new: true }
  );

  if (!updated) return { ok: false, error: "BOOKING_NOT_FOUND" };
  return { ok: true, booking: updated };
}

// health
router.get("/health", (req, res) => res.json({ ok: true, payments: true }));

// create intent (lo dejás igual, pero garantizamos metadata bookingId)
router.post("/create-intent", express.json(), async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: "STRIPE_SECRET_KEY_MISSING" });

    const amount = Number(req.body?.amount || 0);
    const currency = String(req.body?.currency || "usd").toLowerCase();
    const bookingId = safeStr(req.body?.bookingId);

    if (!amount || amount < 50) return res.status(400).json({ error: "INVALID_AMOUNT" });
    if (!bookingId) return res.status(400).json({ error: "BOOKING_ID_MISSING" });

    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: { bookingId }, // <- CLAVE para el webhook / update
      automatic_payment_methods: { enabled: true },
    });

    return res.status(200).json({
      ok: true,
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

/**
 * confirm-test
 * - NO requiere app
 * - Confirma el PaymentIntent con tarjeta TEST (pm_card_visa)
 * - Si succeeded -> marca booking PAID en Mongo
 */
router.post("/confirm-test", express.json(), async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: "STRIPE_SECRET_KEY_MISSING" });

    const paymentIntentId = safeStr(req.body?.paymentIntentId);
    let bookingId = safeStr(req.body?.bookingId);

    if (!paymentIntentId) return res.status(400).json({ error: "PAYMENT_INTENT_ID_MISSING" });

    // Traemos PI
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    // si no te pasaron bookingId, lo intentamos sacar del metadata
    if (!bookingId) bookingId = safeStr(pi?.metadata?.bookingId);

    // Si ya está succeeded, marcamos igual booking PAID
    if (pi.status === "succeeded") {
      const r = await markPaidByBookingId(bookingId, pi.id);
      return res.status(200).json({ ok: true, piStatus: pi.status, marked: r });
    }

    // Confirmamos con método de pago TEST
    // (esto crea “pago” en modo test)
    const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: "pm_card_visa",
    });

    // Si quedó succeeded -> update DB
    if (confirmed.status === "succeeded") {
      const r = await markPaidByBookingId(bookingId, confirmed.id);
      return res.status(200).json({ ok: true, piStatus: confirmed.status, marked: r });
    }

    // Si no succeeded, devolvemos estado para debug
    return res.status(200).json({
      ok: false,
      piStatus: confirmed.status,
      message: "NOT_SUCCEEDED",
      next_action: confirmed.next_action || null,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

export default router;

