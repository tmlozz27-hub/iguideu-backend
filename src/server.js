// src/server.js (ESM)
// BACKEND IGUIDEU-24 — seguro, simple, sin romper lo que ya anda.

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

// -------------------- PATHS + ENV --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carga .env desde la raíz del repo (…/backend-iguideu-24/.env)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// -------------------- MONGO CONNECT (SAFE) --------------------
async function connectMongo() {
  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    "";

  if (!uri) {
    console.log("[mongo] ⚠️  No MONGO_URI found in .env (MONGO_URI/MONGODB_URI/DATABASE_URL). DB will stay disconnected.");
    return false;
  }

  try {
    // Recomendado para evitar buffering eterno
    mongoose.set("strictQuery", true);

    // timeouts razonables
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 20000,
      connectTimeoutMS: 10000,
    });

    console.log("[mongo] ✅ connected. readyState=", mongoose.connection.readyState);
    return true;
  } catch (err) {
    console.log("[mongo] ❌ connect error:", err?.message || err);
    return false;
  }
}

// -------------------- APP --------------------
const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// -------------------- CORS --------------------
const allowAll = process.env.CORS_ALLOW_ALL === "true";
const rawOrigins =
  process.env.CORS_ORIGINS ||
  process.env.CLIENT_URL ||
  "http://localhost:8081,http://localhost:8082,http://localhost:19006";

const allowedOrigins = rawOrigins
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // Postman/CLI
      if (allowAll) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// -------------------- HEALTH --------------------
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "backend-iguideu-24",
    ts: new Date().toISOString(),
    dbState: mongoose?.connection?.readyState ?? null,
  });
});

// -------------------- ROUTES --------------------
let guidesRoutes = null;
let bookingsRoutes = null;

try {
  const mod = await import("./routes/guides.routes.js");
  guidesRoutes = mod?.default || null;
} catch (e) {
  guidesRoutes = null;
}

try {
  const mod = await import("./routes/bookings.routes.js");
  bookingsRoutes = mod?.default || null;
} catch (e) {
  bookingsRoutes = null;
}

if (guidesRoutes) {
  app.use("/api/guides", guidesRoutes);
} else {
  app.get("/api/guides", (req, res) => {
    res.status(200).json({ ok: true, source: "fallback-no-routes", guides: [] });
  });
}

if (bookingsRoutes) {
  app.use("/api/bookings", bookingsRoutes);
} else {
  app.get("/api/bookings", (req, res) => {
    const email = (req.query.email || "").toString().trim() || null;
    res.status(200).json({ ok: true, source: "fallback-no-routes", email, bookings: [] });
  });
}

// -------------------- 404 --------------------
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Not Found", path: req.originalUrl });
});

// -------------------- ERROR HANDLER --------------------
app.use((err, req, res, next) => {
  res.status(500).json({ ok: false, error: err?.message || "Server error" });
});

// -------------------- START --------------------
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4020);

(async () => {
  await connectMongo();

  app.listen(PORT, HOST, () => {
    console.log(`Server ON -> http://${HOST}:${PORT}`);
  });
})();
