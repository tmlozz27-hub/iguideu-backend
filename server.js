import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import Stripe from "stripe";

import ordersRouter from "./src/routes/orders.routes.js";
import webhooksRouter from "./src/routes/webhooks.routes.js";

const app = express();

// ===== Stripe (compartido en app) =====
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️ STRIPE_SECRET_KEY no definido (solo podrás usar endpoints sin Stripe)");
}
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
app.set("stripe", stripe);

// ===== Seguridad base =====
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS estricto: toma de env (coma separada) o fallback local
const allowed = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : ["http://127.0.0.1:5177"];
app.use(
  cors({
    origin: (origin, cb) => {
      // Permitir tools / curl (sin origin) y los orígenes whitelisted
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"));
    },
    credentials: false,
  })
);

// ===== Rate Limits (suaves) =====
const ordersLimiter = rateLimit({ windowMs: 60_000, max: 60 });
const webhookLimiter = rateLimit({ windowMs: 60_000, max: 120 });

// ⚠️ Webhooks (RAW) antes del json global
app.use("/api/webhooks", webhookLimiter, webhooksRouter);

// JSON global
app.use(express.json());

// Health
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGO_URI,
    dbState: mongoose.connection.readyState, // 0,1,2,3
    payments: "stripe",
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
  });
});

// API
app.use("/api/orders", ordersLimiter, ordersRouter);

// Debug
app.get("/api/_ping", (req, res) => {
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    commit: process.env.RENDER_GIT_COMMIT || "unknown",
  });
});

app.get("/api/_routes", (req, res) => {
  const out = [];
  app._router.stack.forEach((m) => {
    if (m.route?.path) {
      out.push({ path: m.route.path, methods: Object.keys(m.route.methods) });
    } else if (m.name === "router" && m.regexp && m.handle?.stack) {
      const base = (m.regexp.source || "")
        .replace("^\\", "")
        .replace("\\/?(?=\\/|$)", "")
        .replace(/\\\//g, "/")
        .replace(/\$$/, "");
      m.handle.stack.forEach((s) => {
        if (s.route?.path) {
          out.push({
            path: `/${base}${s.route.path}`.replace(/\/{2,}/g, "/"),
            methods: Object.keys(s.route.methods),
          });
        }
      });
    }
  });
  res.json({ routes: out, Count: out.length });
});

// DB + server
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("✅ MongoDB conectado");
    } else {
      console.warn("⚠️ MONGO_URI no definido, iniciando sin DB.");
    }
    app.listen(PORT, "0.0.0.0", () =>
      console.log(`✅ Express ON :${PORT} NODE_ENV=${process.env.NODE_ENV || "dev"}`)
    );
  } catch (err) {
    console.error("❌ Error al iniciar:", err);
    process.exit(1);
  }
}

start();
