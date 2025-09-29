import Stripe from "stripe";
import Order from "../models/order.model.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
});

// Crear PaymentIntent + Order
export async function createPaymentIntent(req, res) {
  try {
    const { amount, currency, metadata } = req.body;

    // ✅ SOLO tarjeta (card-only) => evita pedir return_url
    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ["card"], // 👈 importante
      metadata,
    });

    const order = await Order.create({
      amount,
      currency,
      status: pi.status,
      paymentIntentId: pi.id,
      metadata,
    });

    return res.json({
      ok: true,
      orderId: order._id,
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret,
      status: pi.status,
    });
  } catch (err) {
    console.error("❌ Error en createPaymentIntent:", err);
    res.status(500).json({ error: err.message });
  }
}

// Listar orders
export async function listOrders(req, res) {
  try {
    const { limit = 10 } = req.query;
    const docs = await Order.find().sort({ createdAt: -1 }).limit(Number(limit));
    res.json({
      page: 1,
      limit: Number(limit),
      total: docs.length,
      items: docs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Buscar order por ID
export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Buscar order por paymentIntentId
export async function getOrderByPaymentIntent(req, res) {
  try {
    const { paymentIntentId } = req.params;
    const order = await Order.findOne({ paymentIntentId });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
