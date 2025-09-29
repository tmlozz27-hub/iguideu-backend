import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import ordersRouter from "./src/routes/orders.routes.js";
import webhooksRouter from "./src/routes/webhooks.routes.js";

// ✅ Importamos el modelo directo para calcular stats acá mismo
import Order from "./src/models/order.model.js";

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
    dbState: mongoose.connection.readyState,
    payments: "stripe",
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
  });
});

/**
 * 🟢 BYPASS: Stats fuera del router
 * GET /api/_orders_stats
 */
app.get("/api/_orders_stats", async (_req, res) => {
  try {
    const now = new Date();
    const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const from7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);

    const [ total, byStatusAgg ] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);
    const byStatus = byStatusAgg.reduce((acc, i) => { acc[i._id] = i.count; return acc; }, {});

    const sumSucceededAgg = await Order.aggregate([
      { $match: { status: "succeeded" } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
      { $project: { _id: 0, amount: 1 } },
    ]);
    const totalAmountSucceeded = sumSucceededAgg[0]?.amount || 0;

    const [ last24hAgg, last24hSucceededAgg ] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: from24h } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
        { $project: { _id: 0, count: 1, amount: 1 } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: from24h }, status: "succeeded" } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
        { $project: { _id: 0, count: 1, amount: 1 } },
      ]),
    ]);
    const last24h = {
      count:  last24hAgg[0]?.count  || 0,
      amount: last24hAgg[0]?.amount || 0,
      succeeded: {
        count:  last24hSucceededAgg[0]?.count  || 0,
        amount: last24hSucceededAgg[0]?.amount || 0,
      }
    };

    const last7dAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: from7d }, status: "succeeded" } },
      {
        $group: {
          _id: {
            y: { $year: "$createdAt" },
            m: { $month: "$createdAt" },
            d: { $dayOfMonth: "$createdAt" },
          },
          count:  { $sum: 1 },
          amount: { $sum: "$amount" },
        }
      },
      {
        $project: {
          _id: 0,
          date: { $dateFromParts: { year: "$_id.y", month: "$_id.m", day: "$_id.d" } },
          count: 1,
          amount: 1,
        }
      },
      { $sort: { date: 1 } },
    ]);

    res.json({
      generatedAt: now.toISOString(),
      total,
      byStatus,
      totalAmountSucceeded,
      last24h,
      last7dSucceededDaily: last7dAgg,
    });
  } catch (err) {
    console.error("[_orders_stats] error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// API (router)
app.use("/api/orders", ordersRouter);

// Debug
app.get("/api/_ping", (_req, res) => {
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

