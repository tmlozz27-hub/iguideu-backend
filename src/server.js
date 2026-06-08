import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();

// --- Middleware base
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: "*", credentials: false }));

// --- Mongo
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "";
if (!MONGO_URI) {
  console.log("⚠️  Falta MONGO_URI en .env");
}

let dbReady = false;

async function connectMongo() {
  if (!MONGO_URI) return;

  try {
    if (mongoose.connection.readyState === 1) {
      dbReady = true;
      return;
    }
    await mongoose.connect(MONGO_URI, { dbName: process.env.DB_NAME || undefined });
    dbReady = true;
    console.log("✅ MongoDB conectado");
  } catch (e) {
    dbReady = false;
    console.log("❌ Mongo error:", e?.message || e);
  }
}

// Conectar una vez al boot
await connectMongo();

// --- Health
app.get("/api/health", async (req, res) => {
  // si se cayó, intentamos reconectar suave
  if (!dbReady) await connectMongo();

  res.json({
    ok: true,
    dbReady,
    ts: new Date().toISOString(),
  });
});

import authRouter from "./routes/auth.routes.js";

// --- Rutas
app.use("/api", authRouter);
// IMPORTANTE: vamos a montar bookings.routes.js como “fuente de verdad”
import bookingsRouter from "./routes/bookings.routes.js";
app.use("/api/bookings", bookingsRouter);

// Si ya tenés guías en otro archivo, dejalo. Si no existe, no rompe.
try {
  const guidesMod = await import("./routes/guides.routes.js");
  app.use("/api/guides", guidesMod.default);
} catch (_) {
  // fallback por si tu proyecto usa otra ruta
  try {
    const guidesMod2 = await import("./routes/guides.js");
    app.use("/api/guides", guidesMod2.default);
  } catch (_) {}
}

// --- 404 JSON
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "not_found", path: req.path });
});

// --- Error handler
app.use((err, req, res, next) => {
  console.log("❌ Error:", err?.message || err);
  res.status(500).json({ ok: false, error: err?.message || "server_error" });
});

// --- Mantener vivo + logs de crashes
process.on("uncaughtException", (e) => {
  console.log("❌ uncaughtException:", e?.message || e);
});
process.on("unhandledRejection", (e) => {
  console.log("❌ unhandledRejection:", e?.message || e);
});

const PORT = Number(process.env.PORT || 4020);
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Backend ON → http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("🛑 SIGINT -> cerrando server...");
  server.close(() => process.exit(0));
});

