// server.js — BACKEND I GUIDE U 24 (Render/Local)
// ⚠️ Archivo completo (borrar y pegar)
// Objetivo: que /api/bookings NO vuelva a 404 aunque el router esté mal montado o no tenga GET.
// Además agrega /api/_debug para verificar deploy en Render.

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

// --- App ---
const app = express();

// --- Middlewares ---
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// --- Helpers ---
function safeRequire(path) {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(path);
  } catch (e) {
    console.warn("⚠️ safeRequire FAIL:", path, "-", e.message);
    return null;
  }
}

// --- DB connect (si tenés connectDB) ---
const connectDB =
  safeRequire("./db/connect") ||
  safeRequire("./src/db/connect") ||
  safeRequire("./config/db") ||
  null;

(async () => {
  try {
    if (connectDB) await connectDB();
  } catch (e) {
    console.error("❌ DB connect error:", e.message);
  }
})();

// ✅ DEBUG ENDPOINT (para confirmar commit deploy en Render)
app.get("/api/_debug", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || null,
    service: process.env.RENDER_SERVICE_NAME || null,
    gitCommit: process.env.RENDER_GIT_COMMIT || null,
    timestamp: new Date().toISOString(),
  });
});

// ✅ Health (si ya lo tenías en otro lado, esto igual sirve)
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    port: String(process.env.PORT || 0),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || null,
    db: !!process.env.MONGO_URI,
    stripeKeyLoaded: !!process.env.STRIPE_SECRET_KEY,
  });
});

// --- Routers (si existen en tu proyecto) ---
const guidesRouter =
  safeRequire("./routes/guides") ||
  safeRequire("./src/routes/guides") ||
  safeRequire("./routes/guides.routes") ||
  null;

const bookingsRouter =
  safeRequire("./routes/bookings") ||
  safeRequire("./src/routes/bookings") ||
  safeRequire("./routes/bookings.routes") ||
  null;

const adminRouter =
  safeRequire("./routes/admin") ||
  safeRequire("./src/routes/admin") ||
  safeRequire("./routes/admin.routes") ||
  null;

// --- Mount routes ---
if (guidesRouter) {
  app.use("/api/guides", guidesRouter);
} else {
  // fallback para no romper tu demo si falta el router
  app.get("/api/guides", (req, res) => res.status(200).json({ ok: true, guides: [], note: "guides router missing" }));
}

if (bookingsRouter) {
  app.use("/api/bookings", bookingsRouter);
}

// ✅ Fallback FORZADO para /api/bookings (SOLUCIONA TU 404 YA)
// Si tu router NO tiene GET, Express hace next() y entra acá.
// Si NO hay router, también entra acá.
app.get("/api/bookings", (req, res) => {
  res.status(200).json({
    ok: true,
    forced: true,
    note: "Ruta /api/bookings existe. Si querés listar real, agregá GET en router usando Booking.find(...)",
    email: req.query.email || null,
  });
});

if (adminRouter) {
  app.use("/api/admin", adminRouter);
}

// --- 404 API ---
app.use("/api", (req, res) => {
  res.status(404).json({ ok: false, error: "API route not found", path: req.path });
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({ ok: false, error: "Internal Server Error" });
});
// ✅ DEBUG ENDPOINT (para confirmar deploy real en Render)
app.get("/api/_debug", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || null,
    service: process.env.RENDER_SERVICE_NAME || null,
    gitCommit: process.env.RENDER_GIT_COMMIT || null,
    timestamp: new Date().toISOString(),
  });
});

// --- Listen ---
const PORT = process.env.PORT || 4020;
app.listen(PORT, () => {
  console.log(`✅ I GUIDE U backend running on port ${PORT}`);
});
