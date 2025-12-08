// ===========================
// I GUIDE U – Backend 24
// SERVER.JS COMPLETO FINAL
// ===========================

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

// ===========================
// CORS
// ===========================
app.use(
  cors({
    origin: "*",
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization,x-admin-key",
  })
);

app.options("*", cors());

// ===========================
// JSON PARSER
// ===========================
app.use(express.json());

// ===========================
// MONGO URI – FALLBACK CORRECTO (FUNCIONA EN ATLAS)
// ===========================

// ⚠️ USAR ESTA URI EXACTA (LA BUENA DEL backend-20)
const FALLBACK_URI =
  "mongodb+srv://iguideu20_user:Tomlore414@iguideu-db.sfgtfz8.mongodb.net/iguideu20?retryWrites=true&w=majority&appName=iguideu-db";

// Si Render no pasa MONGO_URI, usamos la buena
const MONGO_URI = process.env.MONGO_URI || FALLBACK_URI;

console.log("DEBUG MONGO_URI:", MONGO_URI);

// ===========================
// MONGO CONNECT
// ===========================
mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => console.log("✅ MongoDB conectado"))
  .catch((err) => console.error("❌ Error MongoDB:", err));

// ===========================
// MODELOS
// ===========================

import Guide from "./models/Guide.js";
import Booking from "./models/Booking.js";

// ===========================
// RUTAS
// ===========================

// Health
app.get("/api/health", async (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    port: process.env.PORT || 4026,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "(none)",
    db: mongoose.connection.readyState === 1,
    stripeKeyLoaded: !!process.env.STRIPE_SECRET_KEY,
  });
});

// Listar guías
app.get("/api/guides", async (req, res) => {
  try {
    const guides = await Guide.find();
    res.json({ ok: true, guides });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error loading guides" });
  }
});

// Listar reservas
app.get("/api/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json({ ok: true, bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error loading bookings" });
  }
});

// ===========================
// SERVER LISTEN
// ===========================

const PORT = process.env.PORT || 4026;

app.listen(PORT, () => {
  console.log(`🚀 Backend 24 corriendo en http://0.0.0.0:${PORT}`);
});
