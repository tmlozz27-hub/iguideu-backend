// routes/payments.js
// Pagos Stripe – I GUIDE U Backend 24

import express from "express";
import Stripe from "stripe";
import Booking from "../models/Booking.js";

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
 * Crea un Checkout de prueba en Stripe (USD 10 por defecto).
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

/**
 * POST /api/payments/create-checkout
 *
 * Flujo real de reserva del viajero (simple):
 * - Recibe datos del guía + horas
 * - Calcula total = priceHour * hours
 * - Crea Checkout en Stripe
 * - Crea una Booking en MongoDB con estado "pending"
 */
router.post("/create-checkout", async (req, res) => {
  try {
    if (!stripe || !STRIPE_SECRET_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Stripe no está configurado en el backend",
      });
    }

    const {
      guideId,
      guideName,
      city,
      country,
      priceHour,
      priceDay,
      hours,
      durationType,
      travelerName,
      travelerEmail,
    } = req.body || {};

    if (!guideId || !guideName || !city || !country) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos del guía (guideId, guideName, city, country).",
      });
    }

    const safeHours = Number(hours) || 1;
    const safePriceHour = Number(priceHour) || 0;

    if (safePriceHour <= 0) {
      return res.status(400).json({
        ok: false,
        error: "priceHour inválido o no definido.",
      });
    }

    const email =
      travelerEmail && typeof travelerEmail === "string"
        ? travelerEmail
        : "test+frontend@iguideu.com";

    // Por ahora usamos un modelo simple: HOURS = priceHour * hours
    const totalUsd = safePriceHour * safeHours;
    const amount = Math.round(totalUsd * 100);

    const descriptionParts = [];
    descriptionParts.push(`${safeHours} hs en ${city}, ${country}`);
    if (durationType) descriptionParts.push(`Tipo: ${durationType}`);
    const description = descriptionParts.join(" · ");

    // 1) Crear sesión de Checkout en Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${guideName} – Reserva I GUIDE U`,
              description,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${PUBLIC_BASE_URL}/stripe-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_BASE_URL}/stripe-cancel.html`,
      metadata: {
        guideId,
        guideName,
        city,
        country,
        hours: String(safeHours),
        durationType: durationType || "HOURS",
        totalUsd: String(totalUsd),
        source: "iguideu-frontend-demo",
      },
    });

    // 2) Registrar la reserva en MongoDB con estado "pending"
    await Booking.create({
      guideId,
      guideName,
      city,
      country,
      travelerName: travelerName || null,
      travelerEmail: email,
      durationType: durationType || "HOURS",
      hours: safeHours,
      baseAmountUsd: totalUsd,
      extraAmountUsd: 0,
      totalAmountUsd: totalUsd,
      paymentStatus: "pending",
      stripeCheckoutSessionId: session.id,
      source: "iguideu-frontend-demo",
    });

    return res.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      totalUsd,
    });
  } catch (err) {
    console.error("[ERROR] /api/payments/create-checkout:", err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

export default router;
