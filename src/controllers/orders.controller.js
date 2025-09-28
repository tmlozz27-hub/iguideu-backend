import Stripe from "stripe";
import Order from "../models/order.model.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
});

export async function createPaymentIntent(req, res) {
  try {
    const { amount, currency = "usd", metadata = {} } = req.body || {};
    if (!amount || !Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: "amount debe ser un entero > 0 (centavos)" });
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "Stripe no configurado (STRIPE_SECRET_KEY faltante)" });
    }

    // 1) Crear PaymentIntent en Stripe
    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata,
    });

    // 2) Guardar Order en Mongo
    const order = await Order.create({
      amount,
      currency,
      status: pi.status ?? "pending",
      paymentIntentId: pi.id,
      metadata,
    });

    // 3) Responder al cliente
    return res.status(201).json({
      ok: true,
      orderId: order._id,
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret,
      status: pi.status,
    });
  } catch (err) {
    console.error("createPaymentIntent err:", err);
    return res.status(500).json({ error: "No se pudo crear el intent", detail: err?.message });
  }
}

export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: "Order no encontrada" });
    res.json(order);
  } catch {
    res.status(400).json({ error: "ID inválido" });
  }
}

export async function listOrders(req, res) {
  const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit ?? "20", 10), 1), 100);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Order.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(),
  ]);

  res.json({ page, limit, total, items });
}

export async function getOrderBy
