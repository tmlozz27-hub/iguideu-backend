/**
 * IGUIDEU BACKEND - server.js (CommonJS)
 * Stable minimal API:
 *  - GET  /api/health
 *  - GET  /api/guides
 *  - GET  /api/bookings
 *  - POST /api/bookings
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

// Models
const Guide = require("./models/Guide");
const Booking = require("./models/Booking");

const app = express();

// ----- Middlewares
app.use(cors({ origin: "*", credentials: false }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ----- Mongo connect
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || undefined;

async function connectMongo() {
  if (!MONGO_URI) {
    console.warn("⚠️ Missing MONGO_URI / MONGODB_URI in .env");
    return false;
  }
  if (mongoose.connection.readyState === 1) return true;

  try {
    await mongoose.connect(MONGO_URI, DB_NAME ? { dbName: DB_NAME } : {});
    return true;
  } catch (err) {
    console.error("❌ MongoDB connect error:", err?.message || err);
    return false;
  }
}

// Connect once at boot (non-blocking-ish but awaited)
connectMongo().then((ok) => {
  if (ok) console.log("✅ MongoDB OK → dbName=" + (mongoose.connection.name || DB_NAME || "<default>"));
  else console.log("❌ MongoDB NOT CONNECTED");
});

// ----- Helpers
function stripeKeyLoaded() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET ||
      process.env.STRIPE_KEY
  );
}

// ----- Routes
app.get("/api/health", async (req, res) => {
  const dbOk =
    mongoose.connection.readyState === 1 ? true : await connectMongo();

  const publicBaseUrl =
    process.env.PUBLIC_BASE_URL ||
    `http://${req.hostname}:${process.env.PORT || 4020}`;

  return res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    port: String(process.env.PORT || 4020),
    publicBaseUrl,
    db: dbOk,
    dbName: mongoose.connection.name || DB_NAME || null,
    stripeKeyLoaded: stripeKeyLoaded(),
  });
});

app.get("/api/guides", async (_req, res) => {
  try {
    const guides = await Guide.find({}).lean();
    return res.json({ ok: true, guides });
  } catch (err) {
    console.error("[GET /api/guides] error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

app.get("/api/bookings", async (_req, res) => {
  try {
    const bookings = await Booking.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, bookings });
  } catch (err) {
    console.error("[GET /api/bookings] error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const {
      guideId,
      travelerEmail,
      travelerName,
      startDate,
      hoursRequested,
      notes,
    } = req.body || {};

    if (!guideId || !travelerEmail || !startDate || hoursRequested == null) {
      return res.status(400).json({
        ok: false,
        error: "VALIDATION_ERROR",
        message:
          "Required: guideId, travelerEmail, startDate, hoursRequested",
      });
    }

    const hours = Number(hoursRequested);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      return res.status(400).json({
        ok: false,
        error: "VALIDATION_ERROR",
        message: "hoursRequested must be a number between 1 and 24",
      });
    }

    const booking = await Booking.create({
      guideId,
      travelerEmail,
      travelerName: travelerName || "",
      startDate,
      hoursRequested: hours,
      notes: notes || "",
      status: "pending",
    });

    return res.status(201).json({ ok: true, booking });
  } catch (err) {
    console.error("[POST /api/bookings] error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

// 404
app.use((_req, res) =>
  res.status(404).json({ ok: false, error: "NOT_FOUND" })
);

// Error handler
app.use((err, _req, res, _next) => {
  console.error("❌ Unhandled error:", err?.message || err);
  res.status(500).json({ ok: false, error: "SERVER_ERROR" });
});

// ----- Start
const PORT = Number(process.env.PORT || 4020);
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server ON → http://0.0.0.0:" + PORT);
});
