import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

export async function createPaymentIntent(req, res) {
  try {
    const { amount, currency = "usd", description = "I GUIDE U", metadata = {} } = req.body || {};
    if (!amount || !Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: "amount (integer, cents) requerido" });
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY faltante" });
    }
    const intent = await stripe.paymentIntents.create({
      amount, currency, description, metadata,
      automatic_payment_methods: { enabled: true },
    });
    res.json({ ok: true, paymentIntentId: intent.id, clientSecret: intent.client_secret, currency: intent.currency, amount: intent.amount, status: intent.status });
  } catch (err) {
    console.error("Stripe createIntent error:", err?.message || err);
    res.status(500).json({ ok: false, error: err?.message || "stripe_error" });
  }
}

export async function diagStripe(_req, res) {
  res.json({ ok: true, hasStripeKey: Boolean(process.env.STRIPE_SECRET_KEY), provider: process.env.PAYMENTS_PROVIDER || "stripe" });
}
