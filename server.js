// server.js – Backend I GUIDE U 24 (CommonJS, estable local + Render)

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const Stripe = require("stripe");

// ===============================
// APP
// ===============================
const app = express();

// ===============================
// ENV
// ===============================
const PORT = process.env.PORT || 4026;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5181";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

// ✅ URLs FIJAS Y VÁLIDAS PARA STRIPE (https) – las cambiamos después si querés
const STRIPE_SUCCESS_URL =
  process.env.STRIPE_SUCCESS_URL || "https://iguideu.com/stripe-success-test";
const STRIPE_CANCEL_URL =
  process.env.STRIPE_CANCEL_URL || "https://iguideu.com/stripe-cancel-test";

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// ===============================
// CORS / Seguridad
// ===============================
const allowedOrigins = [
  FRONTEND_URL,
  "http://127.0.0.1:5181",
  "http://localhost:5181",
  "http://192.168.0.4:5181"
];

app.use(helmet());
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS bloqueado desde: " + origin));
    }
  })
);
app.use(morgan("dev"));

// ===============================
// STRIPE WEBHOOK (raw)
// ===============================
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      console.log("⚠️ Webhook recibido pero Stripe no está configurado.");
      return res.status(200).send();
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
      console.error("❌ Error en webhook:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      console.log("✅ Pago completado:", session.id);
    }

    res.json({ received: true });
  }
);

// A partir de acá: JSON normal
app.use(express.json());

// ===============================
// MONGO
// ===============================
const mongoUri = process.env.MONGO_URI;
console.log("DEBUG MONGO_URI:", mongoUri ? "SET" : "MISSING");

mongoose
  .connect(mongoUri || "", {})
  .then(() => {
    console.log("✅ MongoDB OK");
  })
  .catch((err) => {
    console.error("❌ Error conectando a MongoDB:", err.message);
  });

// ===============================
// MODELO DE GUÍAS
// ===============================
const guideSchema = new mongoose.Schema(
  {
    guideId: { type: String, index: true },
    code: String,
    name: String,
    city: String,
    country: String,
    hourlyRate: Number,
    dailyRate: Number,
    rating: Number,
    languages: [String],
    description: String,
    photo: String
  },
  { timestamps: true }
);

const Guide = mongoose.model("Guide", guideSchema, "guides");

// ===============================
// RUTAS API
// ===============================

// Health
app.get("/api/health", (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;

  res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    port: PORT.toString(),
    publicBaseUrl: PUBLIC_BASE_URL,
    cors: allowedOrigins,
    db: dbReady,
    stripeKeyLoaded: Boolean(STRIPE_SECRET_KEY)
  });
});

// Listar guías
app.get("/api/guides", async (req, res) => {
  try {
    const guides = await Guide.find().lean();
    res.json({
      ok: true,
      guides
    });
  } catch (err) {
    console.error("❌ Error /api/guides:", err.message);
    res.status(500).json({ ok: false, error: "Error obteniendo guías" });
  }
});

// Crear checkout (USD 10)
app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    if (!stripe || !STRIPE_SECRET_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Stripe no está configurado (falta STRIPE_SECRET_KEY)"
      });
    }

    console.log("[INFO] Creando Checkout USD 10...");
    console.log("[INFO] success_url:", STRIPE_SUCCESS_URL);
    console.log("[INFO] cancel_url:", STRIPE_CANCEL_URL);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 1000,
            product_data: { name: "Test pago I GUIDE U" }
          },
          quantity: 1
        }
      ],
      success_url: STRIPE_SUCCESS_URL,
      cancel_url: STRIPE_CANCEL_URL
    });

    console.log("[OK] Checkout:", session.id);

    res.json({
      ok: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (err) {
    console.error("❌ Error creando checkout:", err.message);
    res.status(500).json({
      ok: false,
      error: err.message || "Error en Stripe Checkout"
    });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Ruta no encontrada" });
});

// ===============================
// LEVANTAR SERVIDOR
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 iguideu24 en http://0.0.0.0:${PORT}`);
  console.log(`🌍 PUBLIC_BASE_URL: ${PUBLIC_BASE_URL}`);
});
