// src/routes/payments.js

import express from "express";
import Stripe from "stripe";

const router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("⚠️ Falta STRIPE_SECRET_KEY en el backend");
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// Dominio base SEGURO para Stripe (Render, HTTPS)
const BACKEND_DOMAIN = "https://iguideu-backend-1.onrender.com";

router.post("/create-checkout", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        ok: false,
        error: "Stripe no está configurado (falta STRIPE_SECRET_KEY)",
      });
    }

    // Usamos SIEMPRE URLs HTTPS válidas, sin depender de env ni del body
    const successUrl = `${BACKEND_DOMAIN}/api/payments/test-success`;
    const cancelUrl = `${BACKEND_DOMAIN}/api/payments/test-cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 10 * 100, // 10 USD
            product_data: {
              name: "I GUIDE U – Test pago",
              description: "Pago de prueba (USD 10)",
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return res.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("❌ Error creando Checkout Stripe:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Error creando Checkout",
    });
  }
});

// Rutas de prueba para el redirect de Stripe
router.get("/test-success", (req, res) => {
  res.send("<h1>✅ Pago de prueba completado</h1><p>Podés cerrar esta pestaña y volver a I GUIDE U.</p>");
});

router.get("/test-cancel", (req, res) => {
  res.send("<h1>⚠️ Pago cancelado</h1><p>No se realizó el cobro. Podés volver a intentar desde I GUIDE U.</p>");
});

export default router;
