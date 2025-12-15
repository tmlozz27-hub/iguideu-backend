// server.js — BACKEND I GUIDE U 24 (ENTREGA ENTERA)
// Objetivo: debug deploy Render + evitar 404 en /api/bookings + mantener /api/health

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// ===== Middlewares =====
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// ===== Util =====
function safeRequire(p) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(p);
  } catch (e) {
    return null;
  }
}

// ===== DB connect (si existe) =====
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
    env: process.env.NODE_ENV || "development",
    port: String(process.env.PORT || 0),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "https://iguideu-backend-1.onrender.com",
    db: !!process.env.MONGO_URI,
    dbName: process.env.DB_NAME || null,
    stripeKeyLoaded: !!process.env.STRIPE_SECRET_KEY,
    // ✅ Marca para verificar si Render desplegó ESTE commit
    buildTag: "TAG-5447c99",
    renderGitCommit: process.env.RENDER_GIT_COMMIT || null,
  });
});

// ===== Routers (si existen) =====
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

// ===== Mount =====
if (guidesRouter) app.use("/api/guides", guidesRouter);

if (bookingsRouter) app.use("/api/bookings", bookingsRouter);

// ✅ Fallback /api/bookings para NO 404 (sirve para probar deploy)
app.get("/api/bookings", (req, res) => {
  res.status(200).json({
    ok: true,
    forced: true,
    note: "Ruta /api/bookings existe. Si querés listar real: agregar GET en router con Booking.find(...)",
    email: req.query.email || null,
  });
});

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
const PORT = process.env.PORT || 4020;
app.listen(PORT, () => console.log(`✅ I GUIDE U backend running on port ${PORT}`));

