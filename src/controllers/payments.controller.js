import Stripe from "stripe";
import Order from "../models/Order.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// GET /api/payments/diag
export async function paymentsDiag(_req, res) {
  const key = process.env.STRIPE_SECRET_KEY || "";
  res.json({
    ok: true,
    provider: "stripe",
    hasKey: Boolean(key),
    keyPrefix: key ? key.slice(0, 8) : null,
    env: process.env.NODE_ENV || "development",
  });
}

// POST /api/payments/intent
export async function createPaymentIntent(req, res) {
  try {
    const { amount, currency = "usd", metadata = {} } = req.body || {};
    if (!amount || amount <= 0) {
      return res.status(400).json({ ok: false, error: "amount_invalid" });
    }

    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { app: "iguideu9", ...metadata },
    });

    // upsert “order” con estado inicial
    await Order.findOneAndUpdate(
      { paymentIntentId: pi.id },
      {
        paymentIntentId: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        status: pi.status, // "requires_payment_method"
        metadata: pi.metadata || {},
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      ok: true,
      paymentIntentId: pi.id,
      client_secret: pi.client_secret,
      status: pi.status,
      currency: pi.currency,
      amount: pi.amount,
    });
  } catch (err) {
    console.error("createPaymentIntent:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// POST /api/payments/refund
export async function refundPayment(req, res) {
  try {
    const { paymentIntentId, amount } = req.body || {};
    if (!paymentIntentId) {
      return res.status(400).json({ ok: false, error: "paymentIntentId_required" });
    }

    const params = { payment_intent: paymentIntentId };
    if (amount && amount > 0) params.amount = amount;

    const refund = await stripe.refunds.create(params);

    // calcular total refund y actualizar Order
    const all = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 });
    const totalRefunded = all.data.reduce((acc, r) => acc + (r.amount || 0), 0);

    const order = await Order.findOne({ paymentIntentId });
    const originalAmount = order?.amount ?? 0;

    let newStatus = order?.status || "succeeded";
    if (totalRefunded > 0 && totalRefunded < originalAmount) newStatus = "partially_refunded";
    if (originalAmount > 0 && totalRefunded >= originalAmount) newStatus = "refunded";

    await Order.findOneAndUpdate(
      { paymentIntentId },
      {
        $set: {
          refundedAmount: totalRefunded,
          status: newStatus,
        },
        $push: {
          refunds: {
            id: refund.id,
            amount: refund.amount,
            currency: refund.currency,
            status: refund.status,
            created: refund.created,
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ ok: true, refund });
  } catch (err) {
    if (err?.code === "charge_already_refunded") {
      return res.status(409).json({ ok: false, error: "already_refunded_total" });
    }
    console.error("❌ refundPayment:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
