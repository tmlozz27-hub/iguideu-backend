// controllers/paymentsController.js
// Controlador de pagos I GUIDE U (Backend 24)
// - Test pago Stripe (USD 10) para el frontend simple
// - Checkout real de reservas con REGLA FINAL DE DURACIÓN
// - Webhook de Stripe para marcar la reserva como pagada

import Stripe from "stripe";
import Booking from "../models/Booking.js";
import Guide from "../models/Guide.js";
import { calculateBookingPrice } from "../utils/calculateBookingPrice.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// FRONTEND_BASE_URL: para armar las URLs de success/cancel
// Ejemplos típicos:
//  - http://127.0.0.1:5181       (frontend simple local)
//  - https://iguideu-front.onrender.com  (prod/demo)
const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || "http://127.0.0.1:5181";

/**
 * ✅ Endpoint de prueba
 * Test pago Stripe (USD 10) – usado por el frontend simple
 *
 * Si el frontend llama a /api/payments/create-checkout SIN guideId/horas,
 * caemos en este modo test.
 */
export async function createTestCheckout(req, res) {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 10 * 100, // USD 10 en centavos
            product_data: {
              name: "I GUIDE U – Test pago Stripe (USD 10)",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${FRONTEND_BASE_URL}/payments/success-test`,
      cancel_url: `${FRONTEND_BASE_URL}/payments/cancel-test`,
    });

    return res.json({
      ok: true,
      mode: "test",
      amountUsd: 10,
      stripeCheckoutSessionId: session.id,
      url: session.url,
    });
  } catch (err) {
    console.error("createTestCheckout error:", err);
    return res.status(500).json({
      ok: false,
      error: "Error creando checkout de prueba",
      details: err.message,
    });
  }
}

/**
 * ✅ Endpoint principal de reservas
 * Crea un Checkout de Stripe usando la REGLA FINAL de horas:
 *
 * 1 a 7 hs  → hourly
 * 8 hs      → daily (8h)
 * 9 a 12 hs → daily + horas extra
 * 13 a 23 hs→ FULL DAY 24h
 * 24 hs     → FULL DAY 24h
 *
 * Request esperado (JSON):
 * {
 *   "guideId": "....",
 *   "hours": 8,
 *   "travelDate": "2025-12-15",
 *   "travelerName": "Tommy",
 *   "travelerEmail": "test@example.com",
 *   "notes": "Detalle opcional"
 * }
 *
 * Si NO viene guideId u hours → cae al modo test de USD 10 (compatibilidad con frontend simple).
 */
export async function createCheckout(req, res) {
  try {
    const {
      guideId,
      hours,
      travelDate,
      travelerName,
      travelerEmail,
      notes,
    } = req.body || {};

    // 🔹 Si no hay guideId/horas → seguimos usando el flujo de test (USD 10)
    if (!guideId || !hours) {
      return await createTestCheckout(req, res);
    }

    // 🔹 Validaciones básicas
    if (!travelerEmail) {
      return res
        .status(400)
        .json({ ok: false, error: "Falta travelerEmail en el body." });
    }

    if (!Number.isInteger(hours) || hours < 1 || hours > 24) {
      return res.status(400).json({
        ok: false,
        error: "Horas inválidas. Deben ser un entero entre 1 y 24.",
      });
    }

    // 🔹 Buscar guía
    const guide = await Guide.findById(guideId);
    if (!guide) {
      return res.status(404).json({ ok: false, error: "Guide not found" });
    }

    // 🔹 Calcular precio según la REGLA FINAL
    const {
      amount,
      platformFee,
      guideAmount,
      durationType,
      breakdown,
    } = calculateBookingPrice({
      guide,
      hours,
      platformFeePercent: 0.10, // 10% plataforma I GUIDE U
    });

    const currency = "usd";
    const stripeAmount = amount * 100; // centavos

    // 🔹 Crear sesión de Checkout en Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: travelerEmail,
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: stripeAmount,
            product_data: {
              name: `${guide.name} – ${hours}h (${durationType})`,
              description: `${guide.city}, ${guide.country}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        guideId: String(guide._id),
        hours: String(hours),
        travelDate: travelDate || "",
        travelerName: travelerName || "",
        travelerEmail: travelerEmail || "",
        durationType,
      },
      success_url: `${FRONTEND_BASE_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_BASE_URL}/payments/cancel?session_id={CHECKOUT_SESSION_ID}`,
    });

    // 🔹 Crear reserva en estado "pending"
    const booking = await Booking.create({
      guide: guide._id,
      travelerName,
      travelerEmail,
      travelDate,
      hours,
      durationType,
      priceBreakdown: breakdown,
      amountUsd: amount,
      platformFeeUsd: platformFee,
      guideAmountUsd: guideAmount,
      stripeCheckoutSessionId: session.id,
      paymentStatus: "pending",
      origin: "checkout",
      notes,
    });

    return res.json({
      ok: true,
      mode: "booking",
      bookingId: booking._id,
      amountUsd: amount,
      durationType,
      stripeCheckoutSessionId: session.id,
      url: session.url,
    });
  } catch (err) {
    console.error("createCheckout error:", err);
    return res.status(500).json({
      ok: false,
      error: "Error creando checkout de reserva",
      details: err.message,
    });
  }
}

/**
 * ✅ Webhook de Stripe
 * Ruta típica: POST /api/stripe/webhook
 *
 * En server.js tenés que usar express.raw para esta ruta:
 * app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);
 *
 * Acá marcamos la Booking como "paid" cuando llega checkout.session.completed.
 */
export async function stripeWebhook(req, res) {
  try {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        endpointSecret
      );
    } catch (err) {
      console.error("❌ Error verificando firma Webhook Stripe:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Solo nos interesa cuando el Checkout se completa
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const sessionId = session.id;
      const paymentStatus = session.payment_status; // "paid", etc.

      console.log("✅ Webhook checkout.session.completed:", sessionId);

      // Buscar la reserva por stripeCheckoutSessionId
      const booking = await Booking.findOne({
        stripeCheckoutSessionId: sessionId,
      });

      if (!booking) {
        console.warn(
          "⚠️ Webhook: no se encontró Booking con esa sesión:",
          sessionId
        );
      } else {
        // Actualizar estado de pago
        booking.paymentStatus =
          paymentStatus === "paid" ? "paid" : "completed";
        booking.stripePaymentStatus = paymentStatus;
        booking.stripeCustomerEmail = session.customer_details?.email;
        booking.stripeCheckoutCompletedAt = new Date();

        await booking.save();
      }
    }

    // Podés manejar otros eventos si querés
    // else if (event.type === "payment_intent.payment_failed") { ... }

    res.json({ received: true });
  } catch (err) {
    console.error("stripeWebhook error:", err);
    return res.status(500).json({ ok: false, error: "Error en webhook" });
  }
}
