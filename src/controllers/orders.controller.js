// src/controllers/orders.controller.js
import Stripe from 'stripe';
import Order from '../models/Order.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// LISTAR
export const listOrders = async (_req, res) => {
  try {
    const items = await Order.find().sort({ createdAt: -1 });
    return res.json({ ok: true, items });
  } catch (err) {
    console.error('listOrders', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
};

// POR PAYMENT INTENT
export const getOrderByIntent = async (req, res) => {
  try {
    const { piid } = req.params;
    const order = await Order.findOne({ paymentIntentId: piid });
    if (!order) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, order });
  } catch (err) {
    console.error('getOrderByIntent', err);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
};

// SYNC: lee estado real en Stripe y actualiza la orden local
export const syncOrderByPI = async (req, res) => {
  try {
    const piid = req.params.piid || req.body?.paymentIntentId;
    if (!piid) return res.status(400).json({ ok: false, error: 'missing_piid' });

    // 1) PaymentIntent desde Stripe
    const pi = await stripe.paymentIntents.retrieve(piid);

    // 2) Refunds (sumamos todos los reembolsos del PI)
    let refundedAmount = 0;
    let refunds = [];
    try {
      const rlist = await stripe.refunds.list({ payment_intent: pi.id, limit: 100 });
      refunds = rlist.data.map(r => ({
        id: r.id,
        amount: r.amount,
        currency: r.currency,
        status: r.status,
        created: r.created
      }));
      refundedAmount = refunds.reduce((a, r) => a + r.amount, 0);
    } catch (e) {
      // si falla la consulta de refunds, seguimos igual
    }

    // 3) Mapeo simple de status
    const statusMap = {
      succeeded: 'succeeded',
      canceled: 'canceled',
      processing: 'processing',
      requires_payment_method: 'requires_payment_method',
      requires_confirmation: 'requires_confirmation',
      requires_capture: 'requires_capture'
    };
    const status = statusMap[pi.status] || pi.status;

    // 4) Upsert de la orden
    const update = {
      amount: pi.amount,
      currency: pi.currency,
      status,
      metadata: pi.metadata || {},
      refundedAmount,
      refunds
    };

    const order = await Order.findOneAndUpdate(
      { paymentIntentId: pi.id },
      { $set: update },
      { new: true, upsert: true }
    );

    return res.json({
      ok: true,
      order,
      stripe: { status: pi.status, amount: pi.amount, currency: pi.currency }
    });
  } catch (err) {
    console.error('syncOrderByPI', err);
    return res.status(500).json({ ok: false, error: 'sync_failed' });
  }
};
