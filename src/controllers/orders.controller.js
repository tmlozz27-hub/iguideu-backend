// src/controllers/orders.controller.js
import Stripe from "stripe";
import Order from "../models/order.model.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
});

/**
 * POST /api/orders/create-intent
 * Crea PaymentIntent (card-only) y registra Order en MongoDB.
 */
export async function createPaymentIntentAndOrder(req, res) {
  try {
    const { amount, currency = "usd", metadata = {} } = req.body || {};
    if (!amount || !Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: "invalid_amount" });
    }

    // Evitar métodos con redirect -> card only
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      payment_method_types: ["card"],
      metadata,
    });

    // Guardar en Mongo
    const order = await Order.create({
      amount,
      currency,
      status: paymentIntent.status || "requires_payment_method",
      paymentIntentId: paymentIntent.id,
      metadata,
    });

    return res.json({
      ok: true,
      orderId: order._id.toString(),
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    });
  } catch (err) {
    console.error("[createPaymentIntentAndOrder] error:", err);
    return res.status(500).json({ ok: false, error: "stripe_or_db_error" });
  }
}

/**
 * GET /api/orders
 * Listado paginado (desc) por createdAt
 */
export async function listOrders(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit ?? "10", 10), 1), 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Order.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(),
    ]);

    return res.json({ page, limit, total, items });
  } catch (err) {
    console.error("[listOrders] error:", err);
    return res.status(500).json({ ok: false, error: "db_error" });
  }
}

/**
 * GET /api/orders/:id  (ObjectId)
 */
export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).lean();
    if (!order) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json(order);
  } catch (err) {
    console.error("[getOrderById] error:", err);
    return res.status(500).json({ ok: false, error: "db_error" });
  }
}

/**
 * GET /api/orders/by-pi/:paymentIntentId
 */
export async function getOrderByPaymentIntentId(req, res) { // ✅ export que faltaba
  try {
    const { paymentIntentId } = req.params;
    const order = await Order.findOne({ paymentIntentId }).lean();
    if (!order) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json(order);
  } catch (err) {
    console.error("[getOrderByPaymentIntentId] error:", err);
    return res.status(500).json({ ok: false, error: "db_error" });
  }
}

/**
 * (Opcional) GET /api/orders/stats
 */
export async function getOrdersStats(_req, res) {
  try {
    const now = new Date();
    const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [ total, byStatusAgg, succAgg, last24hAgg, last24hSuccAgg ] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { status: "succeeded" } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
        { $project: { _id: 0, amount: 1 } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: from24h } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
        { $project: { _id: 0, count: 1, amount: 1 } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: from24h }, status: "succeeded" } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
        { $project: { _id: 0, count: 1, amount: 1 } },
      ]),
    ]);

    const byStatus = Object.fromEntries(byStatusAgg.map(i => [i._id, i.count]));
    const totalAmountSucceeded = succAgg[0]?.amount ?? 0;

    return res.json({
      generatedAt: now.toISOString(),
      total,
      byStatus,
      totalAmountSucceeded,
      last24h: {
        count:  last24hAgg[0]?.count  ?? 0,
        amount: last24hAgg[0]?.amount ?? 0,
        succeeded: {
          count:  last24hSuccAgg[0]?.count  ?? 0,
          amount: last24hSuccAgg[0]?.amount ?? 0,
        }
      }
    });
  } catch (err) {
    console.error("[getOrdersStats] error:", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}
