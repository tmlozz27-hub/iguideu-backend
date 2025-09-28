// src/routes/payments.routes.js
import express from "express";
import Stripe from "stripe";
import Order from "../models/order.model.js";

const router = express.Router();

// Stripe SDK
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
if (!STRIPE_KEY) {
  console.warn("⚠️ Falta STRIPE_SECRET_KEY en el backend");
}
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;

/**
 * Crear PaymentIntent (usado por el front)
 * POST /api/orders/create-intent
 * body: { amount: int (centavos), currency: "usd", description?: string }
 */
router.post("/orders/create-intent", async (req, res) => {
  try {
    if (!stripe) {
      return res
        .status(500)
        .json({ error: "Stripe no está configurado (falta STRIPE_SECRET_KEY)" });
    }
    const { amount, currency, description, email } = req.body || {};

    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount <= 0 ||
      typeof currency !== "string"
    ) {
      return res.status(400).json({
        error:
          "Parámetros inválidos: { amount (int cents) > 0, currency (string) }",
      });
    }

    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      description: description || "IGU",
      payment_method_types: ["card"],
    });

    // Crear la orden en estado pending
    await Order.create({
      amount,
      currency,
      description: description || "IGU",
      paymentIntentId: pi.id,
      status: "pending",
      email: email || undefined,
    });

    return res.json({ client_secret: pi.client_secret });
  } catch (err) {
    console.error("create-intent error:", err);
    return res
      .status(400)
      .json({ error: err?.message || "Stripe create-intent error" });
  }
});

/**
 * Webhook de Stripe
 * Configurar en Stripe: https://iguideu-backend-fresh.onrender.com/api/payments/webhook
 * Eventos: payment_intent.succeeded, payment_intent.payment_failed
 */
router.post(
  "/payments/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe) return res.sendStatus(200); // para no romper si falta clave

    const sig = req.headers["stripe-signature"];
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      if (!whSecret) {
        // Si no hay secreto, aceptar sin verificar (no ideal, pero evita 400 en pruebas)
        event = JSON.parse(req.body.toString("utf8"));
      } else {
        event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
      }
    } catch (err) {
      console.error("⚠️ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const pi = event.data.object;
          await Order.findOneAndUpdate(
            { paymentIntentId: pi.id },
            { status: "succeeded" }
          );
          console.log("✅ Pago confirmado:", pi.id);
          break;
        }
        case "payment_intent.payment_failed": {
          const pi = event.data.object;
          await Order.findOneAndUpdate(
            { paymentIntentId: pi.id },
            { status: "failed" }
          );
          console.log("❌ Pago fallido:", pi.id);
          break;
        }
        default:
          // ignorar otros eventos
          break;
      }
    } catch (err) {
      console.error("❌ Webhook handler error:", err);
      // igual devolver 200 para que Stripe no reintente en loop por un bug nuestro
    }

    res.sendStatus(200);
  }
);

export default router;
