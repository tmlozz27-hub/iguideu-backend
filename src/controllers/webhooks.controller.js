// src/controllers/webhooks.controller.js
import Stripe from "stripe";
import Order from "../models/order.model.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
});

// Eventos relevantes para actualizar tu Order
const RELEVANT = new Set([
  "payment_intent.succeeded",
  "payment_intent.processing",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
]);

function mapPiToOrderStatus(pi) {
  switch (pi?.status) {
    case "succeeded":
      return "succeeded";
    case "processing":
      return "processing";
    case "requires_payment_method":
      return "requires_payment_method";
    case "requires_action":
      return "requires_action";
    case "canceled":
      return "canceled";
    default:
      return pi?.status || "requires_payment_method";
  }
}

/**
 * IMPORTANTE:
 * - La ruta de webhooks usa express.raw({ type: "application/json" }) y setea req.rawBody.
 * - Montar el router de webhooks ANTES de express.json() en server.js.
 * - Validamos firma con STRIPE_WEBHOOK_SECRET (whsec_... de este endpoint TEST).
 */
export async function stripeWebhookHandler(req, res) {
  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
  } catch (err) {
    console.error("[webhook] signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (!RELEVANT.has(event.type)) {
    return res.status(200).json({ ok: true, ignored: event.type });
  }

  try {
    const pi = event.data.object; // PaymentIntent
    const paymentIntentId = pi.id;
    const newStatus = mapPiToOrderStatus(pi);

    const update = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (pi.latest_charge) update.latestChargeId = pi.latest_charge;
    if (pi.last_payment_error) {
      update.lastError = {
        code: pi.last_payment_error.code,
        message: pi.last_payment_error.message,
        type: pi.last_payment_error.type,
      };
    }

    const order = await Order.findOneAndUpdate(
      { paymentIntentId },
      { $set: update },
      { new: true }
    );

    if (!order) {
      console.warn("[webhook] Order no encontrada para PI:", paymentIntentId, "type:", event.type);
      // 200 para no reintentar indefinidamente
      return res.status(200).json({ ok: true, updated: false });
    }

    console.log("[webhook] Order actualizada:", {
      id: order._id.toString(),
      status: order.status,
      paymentIntentId,
      type: event.type,
    });

    return res.status(200).json({ ok: true, updated: true, status: order.status });
  } catch (err) {
    console.error("[webhook] handler error:", err);
    // 500: Stripe reintenta automáticamente
    return res.status(500).json({ ok: false });
  }
}
