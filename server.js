// server.js – Backend I GUIDE U 24 (ESM)

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

import guidesRouter from "./src/routes/guides.js";
import paymentsRouter from "./src/routes/payments.js";

const app = express();

// === Config básica ===
const ENV = process.env.NODE_ENV || "development";
const PORT = process.env.PORT ? Number(process.env.PORT) : 4026;

// URL pública del backend
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  (ENV === "production"
    ? "https://iguideu-backend-1.onrender.com"
    : `http://127.0.0.1:${PORT}`);

const defaultCorsOrigins = [
  "http://127.0.0.1:5181",
  "http://localhost:5181",
  "http://192.168.0.4:5181"
];

const CORS_ORIGINS = (() => {
  if (!process.env.CORS_ORIGINS) return defaultCorsOrigins;
  return process.env.CORS_ORIGINS.split(",").map((o) => o.trim());
})();

// MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || undefined;

// Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripeKeyLoaded = Boolean(stripeSecretKey);

let dbOk = false;

// === Middlewares globales ===
app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true
  })
);

app.use(express.json());
app.use(morgan(ENV === "production" ? "combined" : "dev"));

// Rate limit
app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// === Health ===
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: ENV,
    port: String(PORT),
    publicBaseUrl: PUBLIC_BASE_URL,
    cors: CORS_ORIGINS,
    db: dbOk,
    stripeKeyLoaded
  });
});

// === Rutas ===
app.use("/api/guides", guidesRouter);
app.use("/api/payments", paymentsRouter);

// Not found /api
app.use("/api", (req, res) =>
  res.status(404).json({
    ok: false,
    error: "Not found",
    path: req.originalUrl
  })
);

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("❌ Error no manejado:", err);
  if (res.headersSent) return;
  res.status(500).json({ ok: false, error: "Internal server error" });
});

// === Start ===
async function start() {
  try {
    if (!MONGODB_URI) {
      dbOk = false;
      console.warn("⚠️ No hay MONGODB_URI");
    } else {
      await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
      dbOk = true;
      console.log("✅ MongoDB OK");
    }
  } catch (err) {
    dbOk = false;
    console.error("❌ Error MongoDB:", err);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Backend 24 en http://0.0.0.0:${PORT}`);
    console.log(`🌍 PublicBaseUrl: ${PUBLIC_BASE_URL}`);
    console.log(`🔐 Stripe key loaded: ${stripeKeyLoaded}`);
  });
}

start().catch((err) => {
  console.error("❌ Error al iniciar:", err);
  process.exit(1);
});
