import express from "express";
import Stripe from "stripe";
import { markBookingPaid } from "../services/payments.service.js";

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const DEFAULT_CURRENCY = (process.env.DEFAULT_CURRENCY || "usd").toLowerCase();

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

router.get("/health", (req, res) => {
  return res.status(200).json({ status: "OK" });
});

router.post("/create-intent", express.json(), async (req, res) => {
  try {
    if (!STRIPE_SECRET_KEY) return res.status(500).json({ ok: false, error: "STRIPE_NOT_CONFIGURED" });

    const bookingId = req.body?.bookingId ? String(req.body.bookingId) : "";

    const amountRaw =
      req.body?.amount !== undefined
        ? req.body.amount
        : req.body?.amountMajor !== undefined
        ? req.body.amountMajor
        : undefined;

    const amountNum = typeof amountRaw === "string" ? Number(amountRaw) : amountRaw;

    if (!bookingId) return res.status(400).json({ ok: false, error: "BOOKING_ID_REQUIRED" });
    if (!amountNum || !Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ ok: false, error: "AMOUNT_REQUIRED" });
    }

    const amountCents = Math.round(amountNum * 100);

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: DEFAULT_CURRENCY,
      metadata: { bookingId },
      automatic_payment_methods: { enabled: true }
    });

    return res.status(200).json({
      ok: true,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amountCents,
      currency: DEFAULT_CURRENCY
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "CREATE_INTENT_FAILED",
      message: err?.message || "error"
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
  } catch (err) {
    return res.status(500).json({ ok: false, error: "FORCE_PAID_FAILED", message: err?.message || "error" });
  }
});

export default router;