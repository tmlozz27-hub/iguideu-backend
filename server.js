import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import ordersRouter from "./src/routes/orders.routes.js";
import webhooksRouter from "./src/routes/webhooks.routes.js";

const app = express();
app.use(cors());

// ⚠️ Webhooks (RAW) antes del json global
app.use("/api/webhooks", webhooksRouter);

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
app.use("/api/orders", ordersRouter);

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
  res.json(out);
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
