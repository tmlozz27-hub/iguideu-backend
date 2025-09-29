// src/controllers/orders.controller.js
import Stripe from "stripe";
import Order from "../models/order.model.js";

/**
 * Obtiene una instancia de Stripe:
 * - Prefiere la que colgamos en app (server.js -> app.set('stripe', ...))
 * - Si no está, usa STRIPE_SECRET_KEY del entorno
 */
function getStripeFrom(req) {
  const s = req.app?.get?.("stripe");
  if (s) return s;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  return new Stripe(key);
}

/** Mapea estado de Stripe a nuestra order.status */
function mapStripeStatus(pi) {
  if (!pi) return "requires_payment_method";
  const st = pi.status;
  if (st === "succeeded") return "succeeded";
  if (st === "processing") return "processing";
  if (st === "requires_payment_method") return "requires_payment_method";
  if (st === "canceled") return "canceled";
  return "requires_payment_method";
}

/** POST /api/orders/create-intent */
export async function createPaymentIntent(req, res) {
  try {
    const stripe = getStripeFrom(req);

    const { amount, currency = "usd", metadata = {} } = req.body || {};
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res
        .status(400)
        .json({ ok: false, error: "invalid_amount" });
    }

    // Forzamos card-only para evitar return_url
    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ["card"],
      metadata,
      // para pruebas evita 3DS fuerte
      payment_method_options: {
        card: { request_three_d_secure: "automatic" },
      },
      // captura automática
      capture_method: "automatic",
    });

    const order = await Order.create({
      amount,
      currency,
      status: mapStripeStatus(pi),
      paymentIntentId: pi.id,
      metadata,
    });

    return res.json({
      ok: true,
      orderId: order._id,
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret,
      status: order.status,
    });
  } catch (err) {
    console.error("❌ createPaymentIntent error:", err?.message, err?.stack);
    const code =
      err?.type === "StripeAuthenticationError"
        ? "stripe_auth_error"
        : err?.type?.startsWith?.("Stripe")
        ? "stripe_api_error"
        : err?.message === "STRIPE_SECRET_KEY missing"
        ? "stripe_key_missing"
        : "stripe_or_db_error";
    return res.status(500).json({
      ok: false,
      error: code,
      message:
        process.env.NODE_ENV === "production"
          ? undefined
          : err?.message || String(err),
    });
  }
}

/** GET /api/orders?limit=... */
export async function listOrders(req, res) {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "10")));
  const items = await Order.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const total = await Order.countDocuments();
  res.json({ page: 1, limit, total, filters: {}, items });
}

/** GET /api/orders/:id */
export async function getOrderById(req, res) {
  const { id } = req.params;
  const found = await Order.findById(id).lean();
  if (!found) return res.status(404).json({ ok: false, error: "not_found" });
  res.json(found);
}

/** GET /api/orders/by-pi/:paymentIntentId */
export async function getOrderByPaymentIntentId(req, res) {
  const { paymentIntentId } = req.params;
  const found = await Order.findOne({ paymentIntentId }).lean();
  if (!found) return res.status(404).json({ ok: false, error: "not_found" });
  res.json(found);
}

/** GET /api/orders/stats  (protegido por x-admin-key) */
export async function orderStats(req, res) {
  const total = await Order.countDocuments();
  const byStatusAgg = await Order.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const byStatus = {};
  for (const r of byStatusAgg) byStatus[r._id] = r.count;

  const last24hSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last24hDocs = await Order.find({ createdAt: { $gte: last24hSince } });
  const last24h = {
    count: last24hDocs.length,
    amount: last24hDocs.reduce((a, o) => a + (o.amount || 0), 0),
    succeeded: {
      count: last24hDocs.filter((o) => o.status === "succeeded").length,
      amount: last24hDocs
        .filter((o) => o.status === "succeeded")
        .reduce((a, o) => a + (o.amount || 0), 0),
    },
  };

  const succeededDocs = await Order.find({ status: "succeeded" });
  const totalAmountSucceeded = succeededDocs.reduce(
    (a, o) => a + (o.amount || 0),
    0
  );

  res.json({
    generatedAt: new Date().toISOString(),
    total,
    byStatus,
    totalAmountSucceeded,
    last24h,
  });
}

/** GET /api/orders/diag/stripe */
export async function diagStripe(req, res) {
  try {
    const stripe = getStripeFrom(req);
    const bal = await stripe.balance.retrieve();
    res.json({ ok: true, livemode: !!bal?.livemode });
  } catch (err) {
    console.error("❌ diagStripe error:", err?.message);
    res
      .status(500)
      .json({ ok: false, error: "stripe_diag_failed", message: err?.message });
  }
}

