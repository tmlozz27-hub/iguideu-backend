// routes/payments.js
// Pagos Stripe – I GUIDE U Backend 24

import express from "express";
import Stripe from "stripe";

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || "https://iguideu-backend-1.onrender.com";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil",
    })
  : null;

/**
 * GET /api/payments/health
 * Pequeño healthcheck de pagos.
 */
router.get("/health", (req, res) => {
  return res.json({
    ok: true,
    stripeKeyLoaded: Boolean(STRIPE_SECRET_KEY),
  });
});

/**
 * POST /api/payments/test-checkout
 *
 * Crea un Checkout de prueba en Stripe (USD 10 por defecto)
 * usado por el frontend simple.
 *
 * Body opcional:
 * { "amountUsd": 10 }
 */
router.post("/test-checkout", async (req, res) => {
  try {
    if (!stripe || !STRIPE_SECRET_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Stripe no está configurado en el backend",
      });
    }

    const amountUsd = Number(req.body?.amountUsd) || 10;
    const amount = Math.round(amountUsd * 100); // centavos

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "I GUIDE U – Test pago Stripe",
              description: "Pago de prueba (demo backend 24)",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${PUBLIC_BASE_URL}/stripe-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_BASE_URL}/stripe-cancel.html`,
    });

    return res.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      amountUsd,
    });
  } catch (err) {
    console.error("[ERROR] /api/payments/test-checkout:", err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

// (Más adelante podemos agregar acá create-checkout real para bookings)

export default router;

