// server.js – Backend I GUIDE U 23 (ESM, puerto 4026)

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import Stripe from "stripe";

dotenv.config();

// -----------------------------------------------------------------------------
// Configuración base
// -----------------------------------------------------------------------------
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = Number(process.env.PORT) || 4026; // Puerto por defecto 4026
const MONGO_URI = process.env.MONGO_URI;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;

console.log("DEBUG MONGO_URI:", MONGO_URI);

const app = express();

// -----------------------------------------------------------------------------
// CORS
// -----------------------------------------------------------------------------
const allowedOrigins = [
  "http://127.0.0.1:5181",
  "http://localhost:5181",
];

if (process.env.FRONTEND_ORIGIN) {
  allowedOrigins.push(process.env.FRONTEND_ORIGIN);
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(morgan("dev"));

// -----------------------------------------------------------------------------
// STRIPE WEBHOOK (RAW BODY ANTES DE express.json)
// -----------------------------------------------------------------------------
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      console.error("Stripe o webhook secret no configurados.");
      return res.status(500).send("Stripe no configurado");
    }

    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Error en webhook Stripe:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log("✅ Webhook Stripe recibido:", event.type);

    switch (event.type) {
      case "checkout.session.completed":
        console.log("💰 Checkout completado:", event.data.object.id);
        break;
      case "payment_intent.succeeded":
        console.log("💳 Pago exitoso:", event.data.object.id);
        break;
      default:
        console.log("ℹ️ Evento Stripe no manejado:", event.type);
    }

    res.json({ received: true });
  }
);

// Después del webhook: JSON normal
app.use(express.json());

// -----------------------------------------------------------------------------
// Conexión a MongoDB
// -----------------------------------------------------------------------------
let dbOk = false;

if (!MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI no definido en .env");
} else {
  mongoose
    .connect(MONGO_URI)
    .then(() => {
      dbOk = true;
      console.log("✅ MongoDB OK");
    })
    .catch((err) => {
      dbOk = false;
      console.error("❌ Error MongoDB:", err.message);
    });
}

// Modelo simple de Guide
const guideSchema = new mongoose.Schema(
  {
    name: String,
    city: String,
    country: String,
    hourlyRate: Number,
    dailyRate: Number,
    rating: Number,
    languages: [String],
    description: String,
  },
  { collection: "guides", strict: false }
);

const Guide =
  mongoose.models.Guide || mongoose.model("Guide", guideSchema);

// -----------------------------------------------------------------------------
// Rutas API
// -----------------------------------------------------------------------------

// Health
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: NODE_ENV,
    port: PORT,
    publicBaseUrl: PUBLIC_BASE_URL,
    db: dbOk,
    stripeKeyLoaded: Boolean(STRIPE_SECRET_KEY),
  });
});

// Obtener guías
app.get("/api/guides", async (req, res) => {
  try {
    let guides = [];

    if (dbOk) {
      guides = await Guide.find().lean();
    }

    // Fallback si no hay guías
    if (!guides || guides.length === 0) {
      guides = [
        {
          id: "g1001",
          name: "Arun – Bangkok Local Guide",
          city: "Bangkok",
          country: "Tailandia",
          hourlyRate: 18,
          dailyRate: 110,
          rating: 4.8,
          languages: ["English", "Thai"],
          description: "Templos, street food y mercados nocturnos.",
        },
        {
          id: "g1002",
          name: "Maya – Kathmandu Cultural Guide",
          city: "Kathmandu",
          country: "Nepal",
          hourlyRate: 15,
          dailyRate: 95,
          rating: 5.0,
          languages: ["English", "Nepali"],
          description: "Durbar Square, Boudhanath y cultura local.",
        },
        {
          id: "g1003",
          name: "Sofia – Experta en Buenos Aires",
          city: "Buenos Aires",
          country: "Argentina",
          hourlyRate: 20,
          dailyRate: 120,
          rating: 4.9,
          languages: ["Spanish", "English"],
          description: "Cafés, barrios clásicos y vida nocturna.",
        },
      ];
    }

    res.json({ ok: true, total: guides.length, guides });
  } catch (err) {
    console.error("❌ Error en /api/guides:", err.message);
    res.status(500).json({ ok: false, error: "GUIDES_ERROR" });
  }
});

// Crear checkout de prueba (USD 10)
const createTestCheckout = async (req, res) => {
  if (!stripe) {
    return res.json({ ok: false, error: "STRIPE_NOT_CONFIGURED" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Test pago Stripe (USD 10)" },
            unit_amount: 1000,
          },
          quantity: 1,
        },
      ],
      success_url: `${PUBLIC_BASE_URL}/stripe-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_BASE_URL}/stripe-cancel`,
    });

    console.log("✅ Checkout creado:", session.id);

    res.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("❌ Error en checkout:", err.message);
    res.json({
      ok: false,
      error: "STRIPE_CHECKOUT_ERROR",
      message: err.message,
    });
  }
};

// Aceptamos múltiples rutas por compatibilidad
app.post("/api/stripe/create-checkout", createTestCheckout);
app.post("/api/payments/create-checkout", createTestCheckout);
app.post("/api/checkout", createTestCheckout);

// Páginas de resultado de Stripe
app.get("/stripe-success", (req, res) => {
  res.send(`
    <h1>✅ Pago recibido (test)</h1>
    <p>Tu pago de prueba en Stripe se completó correctamente.</p>
    <p><a href="/">Volver a I GUIDE U</a></p>
  `);
});

app.get("/stripe-cancel", (req, res) => {
  res.send(`
    <h1>⚠️ Pago cancelado</h1>
    <p>Cancelaste el pago de prueba. Podés intentar de nuevo cuando quieras.</p>
    <p><a href="/">Volver a I GUIDE U</a></p>
  `);
});

// Evitar "Cannot GET /"
app.get("/", (req, res) => {
  res.send(`I GUIDE U backend 23 está online en el puerto ${PORT}.`);
});

// -----------------------------------------------------------------------------
// Arranque del servidor
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 iguideu23 backend demo en http://0.0.0.0:${PORT}`);
});
