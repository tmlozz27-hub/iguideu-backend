// ======================================================
// I GUIDE U - Backend24 - server.js FINAL (PROD READY)
// Booking → Stripe Checkout → Webhook → PAID
// ======================================================

import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import Stripe from "stripe";
import bodyParser from "body-parser";

dotenv.config();

// =====================
// CONFIG
// =====================
const PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || "production";

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || "https://iguideu-backend-1.onrender.com";

const CLIENT_URL =
  process.env.CLIENT_URL || "https://iguideu-frontend.vercel.app";

const ADMIN_KEY =
  process.env.ADMIN_KEY ||
  process.env.ADMIN_API_KEY ||
  "IGU24_admin_K3y_2025_x9!";

// =====================
// STRIPE
// =====================
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = new Stripe(STRIPE_SECRET_KEY);

// =====================
// EXPRESS
// =====================
const app = express();
app.use(cors());

// =====================
// STRIPE WEBHOOK (RAW)
// =====================
app.post(
  "/api/stripe/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    let event;

    try {
      const sig = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;

      if (bookingId && session.payment_status === "paid") {
        await Booking.findByIdAndUpdate(bookingId, {
          status: "PAID",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.payment_intent,
          stripeCustomerEmail: session.customer_details?.email,
        });
      }
    }

    res.json({ received: true });
  }
);

// =====================
// JSON NORMAL
// =====================
app.use(express.json());

// =====================
// MONGO
// =====================
mongoose
  .connect(process.env.MONGO_URI, {
    dbName: process.env.DB_NAME || "iguideu20",
  })
  .then(() => console.log("✅ Mongo conectado"))
  .catch((err) => {
    console.error("❌ Mongo error:", err);
    process.exit(1);
  });

// =====================
// MODELS
// =====================
const Guide = mongoose.model(
  "Guide",
  new mongoose.Schema(
    {
      name: String,
      city: String,
      country: String,
      hourlyRateUsd: Number,
      dayRateUsd: Number,
      fullDay24hRateUsd: Number,
      languages: [String],
      rating: Number,
      description: String,
    },
    { timestamps: true }
  )
);

const Booking = mongoose.model(
  "Booking",
  new mongoose.Schema(
    {
      guideId: mongoose.Schema.Types.ObjectId,
      guideName: String,
      travelerEmail: String,
      durationType: String,
      hours: Number,
      totalAmountUsd: Number,
      currency: { type: String, default: "USD" },
      status: { type: String, default: "PENDING" },
      stripeCheckoutSessionId: String,
      stripePaymentIntentId: String,
      stripeCustomerEmail: String,
    },
    { timestamps: true }
  )
);

// =====================
// ROUTES
// =====================
app.get("/api/health", (req, res) => {
  res.json({ ok: true, env: NODE_ENV });
});

app.get("/api/guides", async (req, res) => {
  const guides = await Guide.find().lean();
  res.json({ ok: true, guides });
});

app.post("/api/bookings/create", async (req, res) => {
  const booking = await Booking.create({
    ...req.body,
    status: "PENDING",
  });
  res.json({ ok: true, booking });
});

app.post("/api/payments/create-checkout", async (req, res) => {
  const { bookingId } = req.body;
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    return res.status(404).json({ ok: false });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: booking.travelerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `I GUIDE U – ${booking.guideName}`,
          },
          unit_amount: Math.round(booking.totalAmountUsd * 100),
        },
        quantity: 1,
      },
    ],
    metadata: { bookingId: String(booking._id) },
    success_url: `${CLIENT_URL}/success`,
    cancel_url: `${CLIENT_URL}/cancel`,
  });

  booking.stripeCheckoutSessionId = session.id;
  await booking.save();

  res.json({ ok: true, url: session.url });
});

app.get("/api/admin/bookings", async (req, res) => {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) {
    return res.status(401).json({ ok: false });
  }

  const { email } = req.query;
  const bookings = await Booking.find(
    email ? { travelerEmail: email } : {}
  ).lean();

  res.json({ ok: true, bookings });
});

// =====================
// START
// =====================
app.listen(PORT, () => {
  console.log(`🚀 Backend LIVE on ${PORT}`);
});
