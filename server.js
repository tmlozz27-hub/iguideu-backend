import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import ordersRouter from "./src/routes/orders.routes.js";
import webhooksRouter from "./src/routes/webhooks.routes.js";
import Order from "./src/models/order.model.js";

const app = express();
app.use(cors());

// Webhooks (raw) antes del json
app.use("/api/webhooks", webhooksRouter);

// JSON global
app.use(express.json());

// Health
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGO_URI,
    dbState: mongoose.connection.readyState,
    payments: "stripe",
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
  });
});

// === DIAGNÓSTICO VISUAL ===
app.get("/api/_whoami", (_req, res) => {
  const routes = [];
  app._router.stack.forEach((m) => {
    if (m.route?.path) routes.push(m.route.path);
    else if (m.name === "router" && m.handle?.stack) {
      m.handle.stack.forEach((s) => s.route?.path && routes.push(s.route.path));
    }
  });
  res.json({
    commit: process.env.RENDER_GIT_COMMIT || "unknown",
    node: process.version,
    entry: "server.js",
    routesCount: routes.length,
    sample: routes.slice(0, 25),
  });
});

// BYPASS: stats fuera del router y ANTES de /api/orders
app.get("/api/_orders_stats", async (_req, res) => {
  try {
    const now = new Date();
    const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const from7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);

    const [ total, byStatusAgg ] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);
    const byStatus = Object.fromEntries(byStatusAgg.map(i => [i._id, i.count]));

    const sumSucc = await Order.aggregate([
      { $match: { status: "succeeded" } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
      { $project: { _id: 0, amount: 1 } },
    ]);
    const totalAmountSucceeded = sumSucc[0]?.amount || 0;

    const last24hAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: from24h } } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      { $project: { _id: 0, count: 1, amount: 1 } },
    ]);
    const last24hSucc = await Order.aggregate([
      { $match: { createdAt: { $gte: from24h }, status: "succeeded" } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      { $project: { _id: 0, count: 1, amount: 1 } },
    ]);

    const last7d = await Order.aggregate([
      { $match: { createdAt: { $gte: from7d }, status: "succeeded" } },
      { $group: {
          _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" }, d: { $dayOfMonth: "$createdAt" } },
          count: { $sum: 1 }, amount: { $sum: "$amount" }
      }},
      { $project: {
          _id: 0,
          date: { $dateFromParts: { year: "$_id.y", month: "$_id.m", day: "$_id.d" } },
          count: 1, amount: 1
      }},
      { $sort: { date: 1 } },
    ]);

    res.json({
      generatedAt: now.toISOString(),
      total,
      byStatus,
      totalAmountSucceeded,
      last24h: {
        count: last24hAgg[0]?.count || 0,
        amount: last24hAgg[0]?.amount || 0,
        succeeded: {
          count:  last24hSucc[0]?.count || 0,
          amount: last24hSucc[0]?.amount || 0,
        }
      },
      last7dSucceededDaily: last7d,
    });
  } catch (err) {
    console.error("[_orders_stats] error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// API principal
app.use("/api/orders", ordersRouter);

// Debug rutas
app.get("/api/_routes", (_req, res) => {
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
