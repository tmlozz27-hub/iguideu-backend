import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

// --- Middleware admin ---
import adminAuth from "./src/middleware/adminAuth.js";

import paymentsStub from "./src/routes/payments.stub.js";
import paymentsRouter from "./src/routes/payments.routes.js";
import ordersRouter from "./src/routes/orders.routes.js";

const app = express();
const PORT = Number(process.env.PORT || 4020);
const HOST = "0.0.0.0";
const useStripe = (process.env.PAYMENTS_PROVIDER || "stub") === "stripe";

// --- Seguridad básica ---
app.use(helmet());
app.use(express.json({ limit: "1mb" }));

// --- CORS dinámico ---
const ALLOWED_ORIGINS = [
  "http://127.0.0.1:5177",
  "http://localhost:5177",
  "http://192.168.0.4:5177",
  "http://127.0.0.1:5178",
  "http://localhost:5178",
  "http://192.168.0.4:5178",
];

const dynamicCors = cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl/PowerShell sin Origin
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    try {
      const host = new URL(origin).hostname;
      if (host.endsWith(".onrender.com")) return cb(null, true);
      if (host.endsWith(".netlify.app")) return cb(null, true);
      if (host.endsWith(".vercel.app")) return cb(null, true);
    } catch {}
    return cb(new Error("CORS not allowed for origin: " + origin));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-admin-key"],
  credentials: false,
  maxAge: 86400,
});

app.use(dynamicCors);
app.options("*", dynamicCors);

// --- Rate limit simple ---
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
  })
);

// --- Mini frontend estático (opcional) ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));

// --- Health ---
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV || "dev",
    hasMongoUri: !!process.env.MONGO_URI,
    dbState: mongoose.connection.readyState,
    payments: useStripe ? "stripe" : "stub",
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    timestamp: new Date().toISOString(),
  });
});

// --- Whoami diag ---
app.get("/api/_whoami", (_req, res) => {
  let hash16 = null;
  if (process.env.ADMIN_API_KEY) {
    const h = crypto
      .createHash("sha256")
      .update(process.env.ADMIN_API_KEY)
      .digest("hex");
    hash16 = h.substring(0, 16);
  }
  res.json({
    env: process.env.NODE_ENV || "dev",
    hasAdminKey: !!process.env.ADMIN_API_KEY,
    adminKeyHash16: hash16,
  });
});

// --- Routers ---
app.use("/api/orders", ordersRouter);
app.use("/api/payments", useStripe ? paymentsRouter : paymentsStub);

// --- Ruta protegida con adminAuth ---
app.get("/api/orders/stats", adminAuth, async (_req, res) => {
  res.json({
    ok: true,
    stats: {
      totalOrders: 42,
      totalRevenue: 999.99,
    },
  });
});

// --- Start ---
app.listen(PORT, HOST, () => {
  console.log(
    `✅ Express ON http://${HOST}:${PORT} (provider=${
      useStripe ? "stripe" : "stub"
    }) PID=${process.pid}`
  );
});
