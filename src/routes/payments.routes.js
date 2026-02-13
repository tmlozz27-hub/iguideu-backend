import express from "express";
import Stripe from "stripe";

const router = express.Router();

// Stripe client (SINGLE source of truth)
const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-06-20" }) : null;

/**
 * ✅ DEBUG: te dice EXACTAMENTE qué cuenta Stripe está usando este backend
 * GET /api/payments/debug-stripe
 */
router.get("/debug-stripe", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY_MISSING" });

    const acct = await stripe.accounts.retrieve();
    return res.json({
      ok: true,
      stripeAccountId: acct.id,
      stripeEmail: acct.email || null,
      country: acct.country || null,
      chargesEnabled: acct.charges_enabled ?? null,
      detailsSubmitted: acct.details_submitted ?? null,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "stripe_error",
      type: e?.type,
    });
  }
});

/**
 * ✅ CREATE INTENT
 * POST /api/payments/create-intent
 * body: { amount, currency, bookingId }
 */
router.post("/create-intent", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY_MISSING" });

    const amount = Number(req.body?.amount || 0);
    const currency = String(req.body?.currency || "usd").toLowerCase();
    const bookingId = String(req.body?.bookingId || "");

    if (!amount || amount < 50) return res.status(400).json({ ok: false, error: "INVALID_AMOUNT" });

    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: bookingId ? { bookingId } : {},
      automatic_payment_methods: { enabled: true },
    });

    // Importantísimo: devolvemos también la cuenta Stripe REAL
    const acct = await stripe.accounts.retrieve();

    return res.status(200).json({
      ok: true,
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret,
      stripeAccountId: acct.id,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "stripe_error",
      type: e?.type,
      code: e?.code,
    });
  }
});

/**
 * ✅ CONFIRM TEST (server-side) SIN APP
 * POST /api/payments/confirm-test
 * body: { paymentIntentId }
 *
 * Usa un payment_method de test universal: pm_card_visa
 */
router.post("/confirm-test", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY_MISSING" });

    const paymentIntentId = String(req.body?.paymentIntentId || "");
    if (!paymentIntentId.startsWith("pi_")) {
      return res.status(400).json({ ok: false, error: "INVALID_PAYMENT_INTENT_ID" });
    }

    // Primero: lo buscamos con ESTA key (si no existe, es key/account equivocado 100%)
    const existing = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Lo confirmamos con método de prueba
    const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: "pm_card_visa",
    });

    return res.json({
      ok: true,
      retrievedStatus: existing.status,
      confirmedStatus: confirmed.status,
      paymentIntentId: confirmed.id,
      livemode: confirmed.livemode,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "stripe_error",
      type: e?.type,
      code: e?.code,
    });
  }
});

export default router;


