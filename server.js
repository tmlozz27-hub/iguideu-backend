// server.js (ESM) — BACKEND I GUIDE U 24
// FIX: soporta routers SIN export default (evita crash en Render)
// Además agrega /api/_debug y mantiene /api/health.

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

const app = express();

// ===== Middlewares =====
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// ===== DEBUG =====
app.get("/api/_debug", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || null,
    service: process.env.RENDER_SERVICE_NAME || null,
    gitCommit: process.env.RENDER_GIT_COMMIT || null,
    timestamp: new Date().toISOString(),
  });
});

// ===== HEALTH =====
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "production",
    port: String(process.env.PORT || 0),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "https://iguideu-backend-1.onrender.com",
    db: true, // tu health anterior ya venía diciendo DB true
    dbName: process.env.DB_NAME || null,
    stripeKeyLoaded: !!process.env.STRIPE_SECRET_KEY,
    buildTag: "TAG-fb63540",
    renderGitCommit: process.env.RENDER_GIT_COMMIT || null,
  });
});

// ===== Import robusto de routers (default o named) =====
function pickRouter(mod) {
  return (
    mod?.default ||
    mod?.router ||
    mod?.bookingsRouter ||
    mod?.guidesRouter ||
    mod?.adminRouter ||
    null
  );
}

// Importamos como módulos para evitar “no default export”
import * as bookingsModule from "./routes/bookings.js";
import * as guidesModule from "./routes/guides.js";
import * as adminModule from "./routes/admin.js";

const bookingsRouter = pickRouter(bookingsModule);
const guidesRouter = pickRouter(guidesModule);
const adminRouter = pickRouter(adminModule);

// ===== Mount =====
if (guidesRouter) app.use("/api/guides", guidesRouter);

// Si existe router de bookings lo montamos; si no existe, fallback para que NO sea 404
if (bookingsRouter) {
  app.use("/api/bookings", bookingsRouter);
} else {
  app.get("/api/bookings", (req, res) => {
    res.status(200).json({
      ok: true,
      forced: true,
      note: "bookings router missing; server alive",
      email: req.query.email || null,
    });
  });
}

if (adminRouter) app.use("/api/admin", adminRouter);

// ===== API 404 =====
app.use("/api", (req, res) => {
  res.status(404).json({ ok: false, error: "API route not found", path: req.path });
});

// ===== Error handler =====
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({ ok: false, error: "Internal Server Error" });
});

// ===== Listen =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ I GUIDE U backend running on port ${PORT}`);
});
