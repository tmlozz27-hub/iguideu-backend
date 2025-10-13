// ===== BACKEND I GUIDE U 10 - SERVER.JS (CommonJS, Render-safe) =====
require("dotenv/config");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();
const PORT = process.env.PORT || 4020;

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";
const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeKey ? new Stripe(stripeKey) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
let dbReady = 0;

// Webhook: debe ir ANTES del JSON parser
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), (req, res) => {
  try {
    if (!stripe || !webhookSecret) return res.sendStatus(500);
    const sig = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log(`✅ Webhook recibido: ${event.type}`);
    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err.message || err);
    return res.sendStatus(400);
  }
});

// Parsers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mongo
(async () => {
  try {
    if (!MONGO_URI) throw new Error("Falta MONGODB_URI/MONGO_URI");
    console.log("🔎 Conectando a Mongo:", MONGO_URI.replace(/:\/\/.*@/, "://***@"));
    const conn = await mongoose.connect(MONGO_URI);
    dbReady = 1;
    console.log(`✅ MongoDB conectado: ${conn.connection.name}`);
  } catch (err) {
    dbReady = 0;
    console.error("❌ Error MongoDB:", err.message);
  }
})();

// Health
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    dbState: dbReady,
    hasMongoUri: !!MONGO_URI,
    payments: "stripe",
    hasStripeKey: !!stripeKey,
    timestamp: new Date().toISOString(),
  });
});

// Payments
app.post("/api/payments/create-intent", async (req, res) => {
  try {
    if (!stripe) return res.json({ ok: false, error: "stripe_key_missing" });
    const { amount, currency } = req.body || {};
    if (!amount || !currency) {
      return res.status(400).json({ ok: false, error: "amount/currency invalid" });
    }
    const pi = await stripe.paymentIntents.create({ amount, currency });
    res.json({ ok: true, paymentIntentId: pi.id, clientSecret: pi.client_secret });
  } catch (err) {
    console.error("❌ Error create-intent:", err.message);
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Debug de rutas
app.get("/__debug/routes", (req, res) => {
  const routes = [];
  app._router.stack.forEach((m) => {
    if (m.route && m.route.path) {
      const methods = Object.keys(m.route.methods).join(",").toUpperCase();
      routes.push(`${methods} ${m.route.path}`);
    }
  });
  res.json({ routes });
});

// Arranque
app.listen(PORT, () => {
  console.log(`✅ Express ON (PORT=${PORT})`);
});

// Evitar que un unhandledRejection termine el proceso en Render
process.on("unhandledRejection", (err) => {
  console.error("UnhandledRejection:", err?.message || err);
});
