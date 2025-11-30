// src/routes/payments.js

import express from "express";
import Stripe from "stripe";
import Booking from "../models/Booking.js";

const router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("⚠️ Falta STRIPE_SECRET_KEY en el backend");
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// Dominio base SEGURO (Render)
const BACKEND_DOMAIN = "https://iguideu-backend-1.onrender.com";

router.post("/create-checkout", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        ok: false,
        error: "Stripe no está configurado (falta STRIPE_SECRET_KEY)",
      });
    }

    const { bookingId } = req.body;

    // URLs base para success y cancel
    const baseSuccessUrl = `${BACKEND_DOMAIN}/api/payments/test-success`;
    const baseCancelUrl = `${BACKEND_DOMAIN}/api/payments/test-cancel`;

    const successUrl =
      bookingId && typeof bookingId === "string"
        ? `${baseSuccessUrl}?bookingId=${bookingId}`
        : baseSuccessUrl;

    const cancelUrl =
      bookingId && typeof bookingId === "string"
        ? `${baseCancelUrl}?bookingId=${bookingId}`
        : baseCancelUrl;

    let amount = 10 * 100; // default 10 USD

    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(400).json({
          ok: false,
          error: "Booking no encontrada para el pago.",
        });
      }
      amount = Math.round(booking.amount * 100);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: "I GUIDE U – Reserva con guía",
              description: "Pago de reserva a través de I GUIDE U",
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    // Guardamos el sessionId en la booking (si existe)
    if (bookingId) {
      await Booking.findByIdAndUpdate(bookingId, {
        stripeSessionId: session.id,
      });
    }

    return res.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("❌ Error creando Checkout Stripe:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Error creando Checkout",
    });
  }
});

// Al volver Stripe, marcamos la booking como "paid" si viene bookingId
router.get("/test-success", async (req, res) => {
  const { bookingId } = req.query;

  if (bookingId) {
    try {
      await Booking.findByIdAndUpdate(bookingId, {
        status: "paid",
      });
    } catch (err) {
      console.error("⚠️ No se pudo actualizar booking a paid:", err);
    }
  }

  res.send(`
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Pago recibido (test) – I GUIDE U</title>
      </head>
      <body style="font-family: system-ui; padding: 20px;">
        <h1>✅ Pago recibido (test)</h1>
        <p>Tu pago de prueba en Stripe se completó correctamente.</p>
        ${
          bookingId
            ? `<p>ID de reserva: <strong>${bookingId}</strong></p>`
            : ""
        }
        <p>Puedes cerrar esta ventana o volver a la app de I GUIDE U.</p>
      </body>
    </html>
  `);
});

router.get("/test-cancel", (req, res) => {
  res.send(`
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Pago cancelado – I GUIDE U</title>
      </head>
      <body style="font-family: system-ui; padding: 20px;">
        <h1>⚠️ Pago cancelado</h1>
        <p>No se realizó el cobro. Puedes volver a intentar desde I GUIDE U.</p>
      </body>
    </html>
  `);
});

export default router;
