import { Router } from "express";
import Stripe from "stripe";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Cargamos Order usando import dinámico para evitar ciclos
async function getOrderModel() {
  const m = await import("../models/Order.js");
  return m.default;
}

// POST /api/orders/create-intent
router.post("/create-intent", async (req, res) => {
  try {
    const { amount, currency = "usd", meta = {} } = req.body || {};
    if (!amount || Number.isNaN(Number(amount))) {
      return res.status(400).json({ ok: false, error: "amount requerido" });
    }

    // Stripe espera centavos
    const amountInCents = Math.round(Number(amount) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { ...meta },
    });

    const Order = await getOrderModel();
    const order = await Order.create({
      amount: amountInCents,
      currency,
      paymentIntentId: paymentIntent.id,
      status: "created",
      meta,
    });

    return res.json({
      ok: true,
      orderId: order._id.toString(),
      clientSecret: paymentIntent.client_secret,
      amount: amountInCents,
      currency,
    });
  } catch (err) {
    console.error("create-intent error:", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// GET /api/orders/:id
router.get("/:id", async (req, res) => {
  try {
    const Order = await getOrderModel();
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({
      ok: true,
      id: order._id,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      paymentIntentId: order.paymentIntentId,
      meta: order.meta || {},
    });
  } catch (err) {
    console.error("get order error:", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// POST /api/orders/:id/refresh  (consulta Stripe y actualiza DB)
router.post("/:id/refresh", async (req, res) => {
  try {
    const Order = await getOrderModel();
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: "not_found" });

    const pi = await stripe.paymentIntents.retrieve(order.paymentIntentId);
    let newStatus = order.status;
    if (pi.status === "succeeded") newStatus = "succeeded";
    else if (pi.status === "requires_payment_method") newStatus = "failed";
    else if (pi.status === "processing") newStatus = "processing";
    else if (pi.status === "requires_action") newStatus = "requires_action";
    else if (pi.status === "requires_confirmation") newStatus = "requires_confirmation";

    if (newStatus !== order.status) {
      order.status = newStatus;
      await order.save();
    }
    return res.json({ ok: true, status: order.status });
  } catch (err) {
    console.error("refresh error:", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;
