// routes/payments.js
// Rutas de pago / Stripe para I GUIDE U 24

const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const Booking = require("../models/Booking");

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const publicBaseUrl = process.env.PUBLIC_BASE_URL || "http://127.0.0.1:4023";

if (!stripeSecretKey) {
  console.warn("[payments] ⚠️ STRIPE_SECRET_KEY no está definido en .env");
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// POST /api/payments/create-checkout
router.post("/create-checkout", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        ok: false,
        error: "Stripe no está configurado (falta STRIPE_SECRET_KEY).",
      });
    }

    const {
      amount,
      currency = "usd",
      guideId,
      travelerId,
      source = "frontend-test",
      metadata = {},
    } = req.body || {};

    // Validaciones básicas
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Monto inválido. Debe ser un número mayor a 0 (en centavos).",
      });
    }

    if (!["usd"].includes(currency)) {
      // se puede ampliar según lo que soporte tu cuenta de Stripe
      return res.status(400).json({
        ok: false,
        error: "Moneda inválida o no soportada.",
      });
    }

    // Cálculo de comisión (10%) y neto guía (90%) en CENTAVOS
    const platformFee = Math.round(amount * 0.1); // 10%
    const guideAmount = amount - platformFee;

    // Creamos la sesión de Checkout en Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: amount,
            product_data: {
              name: "Reserva I GUIDE U",
              description: "Servicio de guía personal de viaje",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${publicBaseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicBaseUrl}/cancel`,
      metadata: {
        source,
        guideId: guideId || "",
        travelerId: travelerId || "",
        ...metadata,
      },
    });

    // Creamos el booking en MongoDB
    const booking = await Booking.create({
      amount,
      currency,
      stripeSessionId: session.id,
      status: "pending", // se actualizará a "paid" desde el webhook más adelante
      platformFee,
      guideAmount,
      guideId,
      travelerId,
      source,
      metadata,
    });

    console.log("[payments] Booking creado:", booking._id, "session:", session.id);

    return res.status(201).json({
      ok: true,
      message: "Checkout creado correctamente.",
      sessionId: session.id,
      url: session.url,
      bookingId: booking._id,
    });
  } catch (err) {
    console.error("[payments] Error en create-checkout:", err);
    return res.status(500).json({
      ok: false,
      error: "Error al crear la sesión de pago.",
    });
  }
});

module.exports = router;
