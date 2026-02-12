import express from "express";
import Stripe from "stripe";

const router = express.Router();
router.get("/health", (req, res) => {
  res.json({ ok: true, payments: true });
});

router.get("/", (req, res) => {
  res.json({ ok: true, route: "/api/payments" });
});

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-06-20" }) : null;

router.post("/create-intent", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: "STRIPE_SECRET_KEY_MISSING" });

    const amount = Number(req.body?.amount || 0);
    const currency = String(req.body?.currency || "usd").toLowerCase();
    const bookingId = String(req.body?.bookingId || "");

    if (!amount || amount < 50) return res.status(400).json({ error: "INVALID_AMOUNT" });

    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: bookingId ? { bookingId } : {},
      automatic_payment_methods: { enabled: true },
    });

    return res.status(200).json({
      ok: true,
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret,
    });
  } catch (e) {
    return res.status(500).json({ error: "CREATE_INTENT_FAILED", message: e?.message || String(e) });
  }
});

export default router;

