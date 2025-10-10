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
