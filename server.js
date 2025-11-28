// ===============================================
// I GUIDE U – Backend 24 (server.js completo)
// ===============================================

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config();

const app = express();

// ============================
//  STRIPE
// ============================

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// ============================
//  CONFIG & SECURITY
// ============================

const CORS_ORIGINS = [
  "http://127.0.0.1:5181",
  "http://localhost:5181",
  "http://192.168.0.4:5181",
];

app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
  })
);

// ⚠️ OJO: NO aplicar express.json() al webhook
app.use((req, res, next) => {
  if (req.originalUrl === "/api/stripe/webhook") {
    return next();
  }
  express.json()(req, res, next);
});

// ============================
//  MONGO
// ============================

mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => console.log("✅ MongoDB conectado"))
  .catch((err) => {
    console.error("❌ Error MongoDB:", err);
    process.exit(1);
  });

// ============================
//  MODELOS
// ============================

const GuideSchema = new mongoose.Schema({
  name: String,
  city: String,
  country: String,
  priceHour: Number,
  priceDay: Number,
  rating: Number,
  description: String,
});

const BookingSchema = new mongoose.Schema(
  {
    guideId: String,
    guideName: String,
    travelerEmail: String,
    date: String,
    hours: Number,
    amountUsd: Number,
    currency: String,
    stripeSessionId: String,
    stripePaymentIntentId: String,
    status: String,
  },
  { timestamps: true }
);

const Guide = mongoose.model("Guide", GuideSchema);
const Booking = mongoose.model("Booking", BookingSchema);

// ============================
//  HEALTH CHECK
// ============================

app.get("/api/health", async (req, res) => {
  return res.json({
    ok: true,
    env: process.env.NODE_ENV,
    port: process.env.PORT,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || null,
    cors: CORS_ORIGINS,
    db: mongoose.connection.readyState === 1,
    stripeKeyLoaded: !!process.env.STRIPE_SECRET_KEY,
  });
});

// ============================
//  GET GUIDES
// ============================

app.get("/api/guides", async (req, res) => {
  const guides = await Guide.find();
  res.json(guides);
});

// ============================
//  FUNCION COMÚN: CHECKOUT STRIPE
// ============================

async function createCheckoutSession(req, res) {
  try {
    let { email, amount } = req.body || {};

    if (!email || !amount) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing email or amount" });
    }

    const successUrl =
      process.env.STRIPE_SUCCESS_URL ||
      (process.env.PUBLIC_BASE_URL
        ? `${process.env.PUBLIC_BASE_URL}/success`
        : null);

    const cancelUrl =
      process.env.STRIPE_CANCEL_URL ||
      (process.env.PUBLIC_BASE_URL
        ? `${process.env.PUBLIC_BASE_URL}/cancel`
        : null);

    if (!successUrl || !cancelUrl) {
      console.error("❌ ERROR CHECKOUT: Missing success/cancel URLs");
      return res.status(500).json({
        ok: false,
        error: "Server misconfigured: missing success/cancel URLs",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "I GUIDE U Booking" },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("❌ ERROR CHECKOUT:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ============================
//  STRIPE CHECKOUT SESSION
// ============================

// Ruta “nueva”: requiere email + amount
app.post("/api/checkout", createCheckoutSession);

// Ruta del FRONTEND SIMPLE: sin body → defaults
app.post("/api/payments/create-checkout", (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    req.body = {};
  }

  if (!req.body.email) {
    req.body.email = "test+frontend@iguideu.com";
  }
  if (!req.body.amount) {
    req.body.amount = 10;
  }

  console.log("⚠️ /api/payments/create-checkout usando defaults", req.body);
  return createCheckoutSession(req, res);
});

// ============================
//  STRIPE WEBHOOK
// ============================

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Error webhook:", err.message);
      return res.status(400).send(`Webhook error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const data = event.data.object;

      await Booking.create({
        travelerEmail: data.customer_email,
        amountUsd: data.amount_total / 100,
        currency: data.currency.toUpperCase(),
        stripeSessionId: data.id,
        stripePaymentIntentId: data.payment_intent,
        guideName: "pending",
        guideId: "pending",
        status: "paid",
        date: "pending",
        hours: 0,
      });

      console.log("✅ Booking creada desde webhook");
    }

    res.json({ received: true });
  }
);

// ===============================================
//  ADMIN AUTH (ACEPTA 2 VARIABLES)
// ===============================================

const ADMIN_KEY =
  process.env.ADMIN_KEY || process.env.ADMIN_API_KEY || "___NO_ADMIN_KEY___";

function adminAuth(req, res, next) {
  const key = req.header("x-admin-key");
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

// ===============================================
//  ADMIN: BOOKINGS
// ===============================================

app.get("/api/admin/bookings", adminAuth, async (req, res) => {
  const emailFilter = req.query.email
    ? { travelerEmail: req.query.email }
    : {};

  const bookings = await Booking.find(emailFilter);
  res.json(bookings);
});

// ============================
//  SERVER START
// ============================

const PORT = process.env.PORT || 4026;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend 24 en http://0.0.0.0:${PORT}`);
});
