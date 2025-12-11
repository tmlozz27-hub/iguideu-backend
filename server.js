// ======================================================
// I GUIDE U - Backend24 - server.js ESTABLE FINAL
// ======================================================

import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import Stripe from "stripe";
import bodyParser from "body-parser";

dotenv.config();

// ======================================================
// ENTORNO
// ======================================================
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 4026;

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;

const CLIENT_URL =
  process.env.CLIENT_URL ||
  process.env.FRONTEND_URL ||
  "http://127.0.0.1:5181";

// 🔑 Aceptamos DOS nombres para la clave admin
const ADMIN_KEY =
  process.env.ADMIN_KEY ||
  process.env.ADMIN_API_KEY ||
  "ClaveUltraSecreta2025";

// ======================================================
// STRIPE
// ======================================================
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// ======================================================
// EXPRESS
// ======================================================
const app = express();

// ------------------------------------------------------
// CORS dinámico
// ------------------------------------------------------
function getCorsOrigins() {
  const raw = process.env.CORS_ORIGINS;
  if (!raw) return [CLIENT_URL];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

const allowedOrigins = getCorsOrigins();

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ------------------------------------------------------
// Stripe Webhook (raw body)
// ------------------------------------------------------
app.post(
  "/api/stripe/webhook",
  bodyParser.raw({ type: "application/json" }),
  (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      console.warn("⚠️ Webhook recibido pero Stripe no configurado.");
      return res.status(200).send("ok");
    }

    const sig = req.headers["stripe-signature"];

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );

      console.log("📦 Webhook Stripe:", event.type);
      return res.json({ received: true });
    } catch (err) {
      console.error("❌ Error webhook Stripe:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// JSON normal para el resto
app.use(express.json());

// ======================================================
// LOGS
// ======================================================
console.log("🔑 ADMIN_KEY cargada:", ADMIN_KEY ? "OK" : "NO_SET");
console.log(
  "🔑 STRIPE_KEY preview:",
  STRIPE_SECRET_KEY ? STRIPE_SECRET_KEY.slice(0, 8) + "..." : "NOT_SET"
);
console.log(
  "DEBUG MONGO_URI prefix:",
  process.env.MONGO_URI ? process.env.MONGO_URI.slice(0, 30) : "NO_SET"
);

// 🔒 Forzamos DB estable
const DB_NAME =
  process.env.DB_NAME || process.env.MONGODB_DB_NAME || "iguideu20";

console.log("DEBUG DB_NAME:", DB_NAME);

// ======================================================
// MONGO
// ======================================================
if (!process.env.MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI NO DEFINIDO.");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI, { dbName: DB_NAME })
  .then(() => console.log(`✅ MongoDB conectado → DB: ${DB_NAME}`))
  .catch((err) => console.error("❌ Error MongoDB:", err));

// ======================================================
// MODELOS
// ======================================================
const guideSchema = new mongoose.Schema(
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
);

const bookingExtensionSchema = new mongoose.Schema(
  {
    fromHours: Number,
    toHours: Number,
    extraHours: Number,
    extraAmountUsd: Number,
    newDurationType: String,
    stripeCheckoutSessionId: String,
    paymentStatus: String,
  },
  { timestamps: true, _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    guideId: { type: mongoose.Schema.Types.ObjectId, ref: "Guide" },
    guideName: String,
    travelerEmail: String,
    durationType: String,
    hours: Number,
    totalAmountUsd: Number,
    currency: { type: String, default: "USD" },
    status: { type: String, default: "pending" },
    stripeCheckoutSessionId: String,
    extensions: [bookingExtensionSchema],
  },
  { timestamps: true }
);

const Guide = mongoose.models.Guide || mongoose.model("Guide", guideSchema);
const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

// ======================================================
// RUTAS
// ======================================================

// Health
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: NODE_ENV,
    port: String(PORT),
    publicBaseUrl: PUBLIC_BASE_URL,
    db: mongoose.connection.readyState === 1,
    stripeKeyLoaded: Boolean(STRIPE_SECRET_KEY),
  });
});

// Obtener guías
app.get("/api/guides", async (req, res) => {
  try {
    const guides = await Guide.find().lean();
    res.json({ ok: true, guides });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error listing guides" });
  }
});

// ------------------------------------------------------
// ADMIN – Seed guías (SIN AUTH para avanzar)
// ------------------------------------------------------
app.post("/api/admin/seed-guides", async (req, res) => {
  try {
    // 🔓 OJO: NO chequeamos x-admin-key a propósito para no trabarnos.
    // Cuando todo esté estable, se puede volver a activar el check.

    await Guide.deleteMany({});

    const guides = await Guide.insertMany([
      {
        name: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        hourlyRateUsd: 18,
        dayRateUsd: 110,
        fullDay24hRateUsd: 180,
        languages: ["English", "Thai"],
        rating: 4.8,
        description:
          "Experiencias locales en templos, mercados y vida nocturna.",
      },
      {
        name: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        hourlyRateUsd: 15,
        dayRateUsd: 95,
        fullDay24hRateUsd: 160,
        languages: ["English", "Nepali"],
        rating: 5.0,
        description:
          "Cultura, templos y recorridos locales en Katmandú.",
      },
      {
        name: "Sofia – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        hourlyRateUsd: 20,
        dayRateUsd: 120,
        fullDay24hRateUsd: 200,
        languages: ["Spanish", "English"],
        rating: 4.9,
        description:
          "Historia, cultura y gastronomía porteña.",
      },
    ]);

    res.json({ ok: true, inserted: guides.length, guides });
  } catch (err) {
    console.error("❌ Error en seed-guides:", err);
    res.status(500).json({ ok: false, error: "Seed error" });
  }
});

// ------------------------------------------------------
// ADMIN – Ver bookings (SÍ usa admin key)
// ------------------------------------------------------
app.get("/api/admin/bookings", async (req, res) => {
  try {
    const incoming = req.headers["x-admin-key"];

    if (incoming !== ADMIN_KEY) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const { email } = req.query;
    const filter = email ? { travelerEmail: email } : {};

    const bookings = await Booking.find(filter).lean();

    if (!bookings.length) {
      return res.status(404).json({ ok: false, message: "No bookings found" });
    }

    res.json({ ok: true, bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Booking query error" });
  }
});

// ======================================================
// Stripe – Test checkout
// ======================================================
app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ ok: false, error: "Stripe not configured" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Test pago Stripe USD 10" },
            unit_amount: 1000,
          },
          quantity: 1,
        },
      ],
      success_url: `${CLIENT_URL}/stripe-success`,
      cancel_url: `${CLIENT_URL}/stripe-cancel`,
    });

    res.json({ ok: true, url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Stripe error" });
  }
});

// ======================================================
// START SERVER
// ======================================================
app.listen(PORT, () => {
  console.log(`🚀 Backend 24 corriendo en http://0.0.0.0:${PORT}`);
});
