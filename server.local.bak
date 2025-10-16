<<<<<<< HEAD
import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import bodyParser from "body-parser";

import notesRoutes from "./src/routes/notes.routes.js";
import paymentsRoutes from "./src/routes/payments.routes.js";
import ordersRoutes from "./src/routes/orders.routes.js";
import { paymentsWebhook } from "./src/controllers/payments.webhook.js";

const app = express();
const PORT = process.env.PORT || 4020;
const MONGO_URI = process.env.MONGO_URI || "";

// ✅ Webhook Stripe ANTES de express.json()
app.post("/api/payments/webhook", bodyParser.raw({ type: "application/json" }), paymentsWebhook);

// Middlewares JSON/CORS
app.use(cors());
app.use(express.json());

// Raíz y health
app.get("/", (_req, res) => res.json({ ok: true, msg: "I GUIDE U 9 root ok" }));
app.get("/api/health", (_req, res) => {
  const dbState = mongoose.connection.readyState; // 0=disconnected 1=connected 2=connecting 3=disconnecting
  res.json({
    status: "ok",
    env: process.env.NODE_ENV || "development",
    dbState,
    hasMongoUri: !!MONGO_URI,
    timestamp: new Date().toISOString(),
  });
});

// Rutas
app.use("/api/notes", notesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/orders", ordersRoutes);

// Mongo + server
mongoose
  .connect(MONGO_URI, { dbName: "iguideu9" })
  .then(() => {
    console.log(`✅ MongoDB conectado: iguideu9`);
    app.listen(PORT, () => {
      console.log(`✅ Express ON http://127.0.0.1:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Error MongoDB:", err.message);
    app.listen(PORT, () => {
      console.log(`✅ Express ON http://127.0.0.1:${PORT}`);
    });
  });
=======
﻿// ===== BACKEND I GUIDE U 10 - SERVER.JS (Render + Mongo + Stripe + Webhook) =====
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import Stripe from "stripe";

const app = express();
const PORT = process.env.PORT || 4020;

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";
const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeKey ? new Stripe(stripeKey) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
let dbReady = 0;

// --- WEBHOOK STRIPE (antes del JSON parser) ---
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

// --- Parsers normales ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Mongo ---
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

// --- Health ---
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

// --- Stripe: create-intent ---
app.post("/api/payments/create-intent", async (req, res) => {
  try {
    if (!stripe) return res.json({ ok: false, error: "stripe_key_missing" });
    const { amount, currency } = req.body || {};
    if (!amount || !currency) return res.status(400).json({ ok: false, error: "amount/currency invalid" });
    const pi = await stripe.paymentIntents.create({ amount, currency });
    res.json({ ok: true, paymentIntentId: pi.id, clientSecret: pi.client_secret });
  } catch (err) {
    console.error("❌ Error create-intent:", err.message);
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Express ON (PORT=${PORT})`);
});
>>>>>>> 5891d35 (Backend 10: server Render-ready (Mongo + Stripe + webhook))
