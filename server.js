// ===== server.js =====
import dotenv from "dotenv";
dotenv.config({ override: true }); // Fuerza que .env reemplace cualquier var previa

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";

// ---- Paths helpers (para servir /public) ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- App base ----
const app = express();
app.use(express.json());

// CORS (si definís CORS_ORIGIN, la uso; si no, permito todo para test)
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: corsOrigin, credentials: true }));

// ---- Info de arranque (sin exponer secretos) ----
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
console.log("BOOT", {
  PAYMENTS_PROVIDER: process.env.PAYMENTS_PROVIDER || "none",
  STRIPE_SECRET_KEY_prefix: STRIPE_KEY.slice(0, 8),
  STRIPE_SECRET_KEY_len: STRIPE_KEY.length,
});

// ---- Stripe ----
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;

// ---- Rutas básicas ----
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "iguideu-backend",
    hint: "try /api/health or /payments-test.html",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    timestamp: new Date(),
    hasMongoUri: !!process.env.MONGO_URI,
    dbState: mongoose.connection.readyState, // 0=disc 1=conn 2=conn.. 3=disc..
    payments: process.env.PAYMENTS_PROVIDER || (stripe ? "stripe" : "none"),
    hasStripeKey: !!STRIPE_KEY,
  });
});

// ---- Stripe Payment Intents ----
async function handleCreateIntent(req, res) {
  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe no está configurado (falta STRIPE_SECRET_KEY)" });
    }
    const { amount, currency, description } = req.body || {};
    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount <= 0 ||
      typeof currency !== "string"
    ) {
      return res.status(400).json({ error: "Parámetros inválidos: { amount (int cents) > 0, currency (string) }" });
    }

    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      description: description || "IGU",
      payment_method_types: ["card"], // evita error de métodos no activados
    });

    return res.json({ client_secret: pi.client_secret });
  } catch (err) {
    console.error("Stripe error:", err);
    return res.status(400).json({ error: err?.message || "Stripe error" });
  }
}

// Rutas oficiales
app.post("/api/payments/create-intent", handleCreateIntent);
app.post("/payments/create-intent", handleCreateIntent);

// Aliases para compatibilidad con el frontend (/orders/...)
app.post("/api/orders/create-intent", handleCreateIntent);
app.post("/orders/create-intent", handleCreateIntent);

// ---- Static (sirve /public) ----
// Si ponés public/payments-test.html: /payments-test.html
app.use(express.static(path.join(__dirname, "public")));

// ---- Mongo + Listen ----
const PORT = process.env.PORT || 4020;

async function start() {
  try {
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("✅ MongoDB conectado");
    } else {
      console.log("ℹ️ MONGO_URI no definido; arrancando sin DB");
    }
  } catch (err) {
    console.error("❌ MongoDB error:", err?.message || err);
  }

  app.listen(PORT, () => {
    console.log(`✅ Express ON http://127.0.0.1:${PORT} (provider=${process.env.PAYMENTS_PROVIDER || (stripe ? "stripe" : "none")})`);
  });
}

start();
