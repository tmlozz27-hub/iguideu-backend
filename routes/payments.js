import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import Booking from "../models/Booking.js";

dotenv.config();

const router = express.Router();

const stripeSecret = process.env.STRIPE_SECRET;

if (!stripeSecret) {
  console.warn("⚠️ STRIPE_SECRET no está definido en process.env (payments.js)");
}

const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  process.env.CLIENT_URL ||
  "http://127.0.0.1:5181";

router.post("/create-checkout", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        ok: false,
        error: "Stripe no está configurado (falta STRIPE_SECRET)",
      });
    }

    const {
      guideName,
      city,
      country,
      durationType,
      hoursCount,
      totalUsd,
      email,
    } = req.body || {};

    if (!guideName || !durationType || !totalUsd) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos de la reserva (guideName, durationType, totalUsd)",
      });
    }

    const safeHours =
      typeof hoursCount === "number" && hoursCount > 0 && hoursCount <= 24
        ? hoursCount
        : null;

    let durationLabel = durationType;
    if (durationType === "HOURS" && safeHours) {
      durationLabel = `HOURS (${safeHours} hs)`;
    } else if (durationType === "DAY") {
      durationLabel = "DAY (8 hs)";
    } else if (durationType === "FULL_DAY_24H") {
      durationLabel = "FULL_DAY_24H (24 hs)";
    }

    // 1) Crear reserva PENDING en Mongo
    const booking = await Booking.create({
      guideName,
      city,
      country,
      duration: durationLabel,
      total: totalUsd,
      email: email || "test+booking@iguideu.com",
      paymentStatus: "PENDING",
      meta: {
        durationType,
        hoursCount: safeHours,
      },
    });

    const amountInCents = Math.round(Number(totalUsd) * 100);

    // 2) Crear sesión de Checkout en Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Reserva I GUIDE U – ${guideName}`,
            },
            unit_amount: amountInCents > 0 ? amountInCents : 1000, // fallback 10 USD
          },
          quantity: 1,
        },
      ],
      success_url: `${FRONTEND_URL}?success=true&bookingId=${booking._id}`,
      cancel_url: FRONTEND_URL,
      metadata: {
        bookingId: String(booking._id),
        guideName,
      },
    });

    // 3) Guardar id de sesión Stripe en la reserva
    booking.stripeCheckoutSessionId = session.id;
    await booking.save();

    return res.json({ ok: true, url: session.url, bookingId: booking._id });
  } catch (err) {
    console.error("Stripe error en /payments/create-checkout", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Error creando Checkout",
    });
  }
});

export default router;
