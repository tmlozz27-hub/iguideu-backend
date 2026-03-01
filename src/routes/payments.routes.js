import express from "express";
import Stripe from "stripe";

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || "";
const DEFAULT_CURRENCY = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();

let stripe = null;
if (STRIPE_SECRET_KEY) stripe = new Stripe(STRIPE_SECRET_KEY);

async function markBookingPaid(bookingId, paymentIntentId) {
  if (!bookingId) return;

  let Booking = null;
  try {
    const mod = await import("../models/Booking.js");
    Booking = mod.default || mod.Booking || null;
  } catch {
    Booking = null;
  }

  if (!Booking) return;

  await Booking.findByIdAndUpdate(
    bookingId,
    {
      $set: {
        status: "PAID",
        stripePaymentIntentId: paymentIntentId || "",
        paidAt: new Date().toISOString(),
      },
    },
    { new: false }
  );
}

router.get("/health", (req, res) => {
  return res.status(200).json({ status: "OK" });
});

router.post("/create-intent", express.json(), async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ ok: false, error: "STRIPE_NOT_CONFIGURED" });
    }

    const bookingId = req.body?.bookingId ? String(req.body.bookingId) : "";
    const amountMajor = req.body?.amount !== undefined && req.body?.amount !== null ? Number(req.body.amount) : null;

    if (!bookingId) {
      return res.status(400).json({ ok: false, error: "BOOKING_ID_REQUIRED" });
    }

    if (!amountMajor || !Number.isFinite(amountMajor) || amountMajor <= 0) {
      return res.status(400).json({ ok: false, error: "AMOUNT_REQUIRED" });
    }

    const amountCents = Math.round(amountMajor * 100);

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: DEFAULT_CURRENCY,
      metadata: { bookingId },
      automatic_payment_methods: { enabled: true },
    });

    return res.status(200).json({
      ok: true,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amountCents,
      currency: DEFAULT_CURRENCY,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "CREATE_INTENT_FAILED",
      message: err?.message || "error",
    });
  }
});

router.post("/force-paid", express.json(), async (req, res) => {
  try {
    if ((process.env.NODE_ENV || "").toLowerCase() !== "development") {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    const bookingId = req.body?.bookingId ? String(req.body.bookingId) : "";
    const paymentIntentId = req.body?.paymentIntentId ? String(req.body.paymentIntentId) : "pi_dev_force_paid";

    if (!bookingId) return res.status(400).json({ ok: false, error: "BOOKING_ID_REQUIRED" });

    await markBookingPaid(bookingId, paymentIntentId);

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: "FORCE_PAID_FAILED" });
  }
});

export default router;