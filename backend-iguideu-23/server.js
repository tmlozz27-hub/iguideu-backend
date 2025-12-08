// Backend I GUIDE U 23 - server.js limpio y estable
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Stripe = require("stripe");

dotenv.config();

const app = express();

// --- Config básica desde .env ---
const PORT = process.env.PORT || 4023;
const MONGO_URI = process.env.MONGO_URI;
const CLIENT_URL = process.env.CLIENT_URL || "http://127.0.0.1:5173";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

let dbOk = false;

// --- CORS ---
const allowedOrigins = [
  CLIENT_URL,
  "http://127.0.0.1:5173",
  "http://localhost:5173",
];

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
};

app.use(cors(corsOptions));

// --- Stripe Webhook (RAW BODY) - debe ir ANTES de express.json() ---
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      if (!STRIPE_SECRET_KEY) {
        console.warn("⚠️ STRIPE_SECRET_KEY no está configurada, se omite validación");
        return res.status(200).send("ok");
      }

      const stripe = Stripe(STRIPE_SECRET_KEY);
      const sig = req.headers["stripe-signature"];
      let event = req.body;

      if (STRIPE_WEBHOOK_SECRET) {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          STRIPE_WEBHOOK_SECRET
        );
      }

      console.log("🔔 Webhook recibido:", event.type);
      res.status(200).send("received");
    } catch (err) {
      console.error("❌ Error en webhook:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// --- Parsers JSON (después del webhook) ---
app.use(express.json());

// --- Health check ---
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    port: PORT,
    publicBaseUrl: PUBLIC_BASE_URL,
    cors: allowedOrigins,
    db: dbOk,
  });
});

// --- Endpoint de prueba de pago (Stripe Checkout) ---
app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    if (!STRIPE_SECRET_KEY) {
      return res
        .status(500)
        .json({ ok: false, error: "Stripe no está configurado" });
    }

    const stripe = Stripe(STRIPE_SECRET_KEY);
    const { amount = 1000, currency = "usd" } = req.body || {};

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: "I GUIDE U test booking",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/payment-cancel`,
    });

    console.log("✅ Checkout creado:", session.id);
    res.json({ ok: true, url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("❌ Error en create-checkout:", err.message);
    res
      .status(500)
      .json({ ok: false, error: "Stripe error", detail: err.message });
  }
});

// --- Conexión a Mongo + arranque del server ---
function startServer() {
  app.listen(PORT, () => {
    console.log(`🚀 iguideu23 en http://0.0.0.0:${PORT}`);
  });
}

if (!MONGO_URI) {
  console.warn("⚠️ MONGO_URI no está definida en .env, se arranca sin DB");
  dbOk = false;
  startServer();
} else {
  mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log("✅ MongoDB OK");
      dbOk = true;
      startServer();
    })
    .catch((err) => {
      console.error("❌ Error conectando a MongoDB:", err.message);
      dbOk = false;
      startServer();
    });
}

module.exports = app;

