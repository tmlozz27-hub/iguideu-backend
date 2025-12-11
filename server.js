// server.js - I GUIDE U Backend 24

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

import Guide from "./models/Guide.js";
import Booking from "./models/Booking.js";
import guidesRouter from "./routes/guides.js";
import bookingsRouter from "./routes/bookings.js";
import paymentsRouter from "./routes/payments.js";

dotenv.config();

// ------------------------
// APP & MIDDLEWARE
// ------------------------
const app = express();

app.use(express.json());
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5181",
      "http://localhost:5181",
      "http://192.168.0.4:5181",
      "http://192.168.1.204:5181",
      "https://iguideu-frontend.example.com",
      "*",
    ],
  })
);

// ------------------------
// VARIABLES
// ------------------------
const PORT = process.env.PORT || 4026;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "iguideu20";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || "https://iguideu-backend-1.onrender.com";
const ADMIN_KEY = "ClaveUltraSecreta2025";

// ------------------------
// DEBUG
// ------------------------
console.log(
  "🔑 STRIPE_SECRET_KEY preview:",
  STRIPE_SECRET_KEY ? STRIPE_SECRET_KEY.slice(0, 15) + "...(OK)" : "NO DEFINIDA"
);
console.log(
  "DEBUG MONGO_URI prefix:",
  MONGO_URI ? MONGO_URI.slice(0, 40) + "..." : "NO DEFINIDA"
);
console.log("DEBUG DB_NAME:", DB_NAME);

// ------------------------
// MONGO CONNECTION
// ------------------------
mongoose
  .connect(MONGO_URI, { dbName: DB_NAME })
  .then(() => {
    console.log(`✅ MongoDB conectado → DB: ${DB_NAME}`);
  })
  .catch((err) => {
    console.error("❌ Error conectando a MongoDB:", err);
  });

// ------------------------
// HEALTH
// ------------------------
app.get("/api/health", (req, res) => {
  return res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    port: PORT.toString(),
    publicBaseUrl: PUBLIC_BASE_URL,
    db: mongoose.connection.readyState === 1,
    stripeKeyLoaded: Boolean(STRIPE_SECRET_KEY),
  });
});

// ------------------------
// RUTAS NORMALES
// ------------------------
app.use("/api/guides", guidesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/payments", paymentsRouter);

// ==================================================
// 🔥 RUTA ADMIN – SEED DEFINITIVO DE GUÍAS
// ==================================================
app.post("/api/admin/seed-guides", async (req, res) => {
  try {
    const adminKey = req.header("x-admin-key");
    if (adminKey !== ADMIN_KEY) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    console.log("[ADMIN] Ejecutando seed definitivo de guías...");

    const docs = [
      {
        id: "arun-bangkok",
        name: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        rating: 4.8,
        priceHour: 18,
        priceDay: 110,
        hourlyRate: 18,
        dailyRate: 110,
        languages: ["English", "Thai"],
        description: "Templos · Street food · Mercados nocturnos",
        guideType: "INDEPENDENT",
        identityVerified: true,
        verificationProvider: "manual",
        verificationAt: new Date(),
      },
      {
        id: "maya-kathmandu",
        name: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        rating: 5.0,
        priceHour: 15,
        priceDay: 95,
        hourlyRate: 15,
        dailyRate: 95,
        languages: ["English", "Nepali"],
        description:
          "Durbar Square, Boudhanath y experiencia local en el valle.",
        guideType: "OFFICIAL",
        identityVerified: true,
        verificationProvider: "manual",
        verificationAt: new Date(),
      },
      {
        id: "sofia-buenosaires",
        name: "Sofía – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        rating: 4.9,
        priceHour: 20,
        priceDay: 120,
        hourlyRate: 20,
        dailyRate: 120,
        languages: ["Spanish", "English"],
        description:
          "Recorridos históricos y culturales por Buenos Aires.",
        guideType: "OFFICIAL",
        identityVerified: true,
        verificationProvider: "manual",
        verificationAt: new Date(),
      },
    ];

    const deleted = await Guide.deleteMany({});
    const inserted = await Guide.insertMany(
      docs.map((d) => ({
        ...d,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );

    console.log(
      `[ADMIN] Seed listo. Borrados: ${deleted.deletedCount}, insertados: ${inserted.length}`
    );

    return res.json({
      ok: true,
      deleted: deleted.deletedCount,
      inserted: inserted.length,
      guides: inserted,
    });
  } catch (err) {
    console.error("[ADMIN] Error en seed:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ==================================================
// 🔥 RUTA ADMIN – LISTAR BOOKINGS (panel admin)
// ==================================================
app.get("/api/admin/bookings", async (req, res) => {
  try {
    const adminKey = req.header("x-admin-key");
    if (adminKey !== ADMIN_KEY) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const email = req.query.email;
    let filter = {};

    if (email) {
      filter = {
        $or: [
          { travelerEmail: email },
          { customerEmail: email },
          { email },
        ],
      };
    }

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      ok: true,
      count: bookings.length,
      value: bookings,
    });
  } catch (err) {
    console.error("[ADMIN] Error listando bookings:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ==================================================
// Páginas simples para Stripe (success / cancel)
// ==================================================
app.get("/stripe-success.html", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Pago de prueba – I GUIDE U</title>
</head>
<body style="font-family: sans-serif; padding: 2rem;">
  <h1>✅ Pago de prueba completado</h1>
  <p>Tu pago de prueba en Stripe se completó correctamente.</p>
  <p>Podés cerrar esta pestaña y volver a I GUIDE U.</p>
</body>
</html>`);
});

app.get("/stripe-cancel.html", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Pago cancelado – I GUIDE U</title>
</head>
<body style="font-family: sans-serif; padding: 2rem;">
  <h1>⚠️ Pago cancelado</h1>
  <p>Cancelaste el pago en Stripe.</p>
  <p>Si fue un error, volvé a I GUIDE U y probá de nuevo.</p>
</body>
</html>`);
});

// ==================================================
// START SERVER
// ==================================================
app.listen(PORT, () => {
  console.log(`🚀 Backend 24 corriendo en http://0.0.0.0:${PORT}`);
});
