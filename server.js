/**
 * IGUIDEU BACKEND - server.js (ESM)
 * Proyecto con package.json: "type": "module"
 *
 * Requiere .env:
 *   PORT=4020
 *   NODE_ENV=development
 *   MONGO_URI=mongodb+srv://...
 *   DB_NAME=iguideu20
 *   CLIENT_URL=http://localhost:8081
 *   PUBLIC_BASE_URL=http://192.168.0.4:4020
 */

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// -------------------- ENV --------------------
const PORT = Number(process.env.PORT || 4020);
const NODE_ENV = process.env.NODE_ENV || "development";

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:8081";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;

const MONGO_URI = process.env.MONGO_URI || "";
const DB_NAME = process.env.DB_NAME || "iguideu20";

const stripeKeyLoaded = Boolean(process.env.STRIPE_SECRET_KEY);

// -------------------- MIDDLEWARE --------------------
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      const allowed = new Set([
        CLIENT_URL,
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:5173",
      ]);

      if (allowed.has(origin)) return cb(null, true);
      if (NODE_ENV !== "production") return cb(null, true);

      return cb(new Error(`CORS bloqueado para origin: ${origin}`));
    },
    credentials: true,
  })
);

// -------------------- MONGO CONNECT --------------------
let dbOk = false;

async function connectMongo() {
  if (!MONGO_URI) {
    console.error("❌ Falta MONGO_URI en .env");
    dbOk = false;
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 7000,
    });
    dbOk = true;
    console.log(`✅ MongoDB OK → dbName=${DB_NAME}`);
  } catch (err) {
    dbOk = false;
    console.error("❌ MongoDB error:", err?.message || err);
  }
}
connectMongo();

// -------------------- SCHEMAS --------------------
const GuideSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    title: { type: String, default: "" },
    city: { type: String, default: "" },
    country: { type: String, default: "" },
    languages: { type: [String], default: [] },
    rating: { type: Number, default: 4.8 },
    reviewsCount: { type: Number, default: 0 },
    pricePerHourUsd: { type: Number, default: 0 },
    pricePerDayUsd: { type: Number, default: 0 },
    pricePer24hUsd: { type: Number, default: 0 },
    photoUrl: { type: String, default: "" },
    bio: { type: String, default: "" },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

const ConversationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    title: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
    messages: {
      type: [
        {
          role: { type: String, enum: ["user", "assistant", "system"], required: true },
          content: { type: String, required: true },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

const Guide = mongoose.models.Guide || mongoose.model("Guide", GuideSchema);
const Conversation =
  mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);

// -------------------- ROUTES --------------------
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    env: NODE_ENV,
    port: String(PORT),
    publicBaseUrl: PUBLIC_BASE_URL,
    db: dbOk,
    dbName: DB_NAME,
    stripeKeyLoaded,
  });
});

app.get("/api/guides", async (_req, res) => {
  try {
    if (!dbOk) {
      return res
        .status(503)
        .json({ ok: false, error: "DB_OFFLINE", message: "Mongo no está conectado" });
    }
    const guides = await Guide.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, guides });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: "GUIDES_ERROR", message: err?.message || "Error" });
  }
});

app.get("/api/guides/:id", async (req, res) => {
  try {
    if (!dbOk) {
      return res
        .status(503)
        .json({ ok: false, error: "DB_OFFLINE", message: "Mongo no está conectado" });
    }
    const guide = await Guide.findById(req.params.id).lean();
    if (!guide) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    return res.json({ ok: true, guide });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: "GUIDE_ERROR", message: err?.message || "Error" });
  }
});

app.get("/api/chat/conversations", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    if (!email) return res.status(400).json({ ok: false, error: "MISSING_EMAIL" });

    if (!dbOk) {
      return res.json({ ok: true, conversations: [], email, db: false });
    }

    const conversations = await Conversation.find({ email })
      .sort({ updatedAt: -1 })
      .select({ messages: 0 })
      .lean();

    return res.json({ ok: true, conversations, email });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: "CHAT_ERROR", message: err?.message || "Error" });
  }
});

// -------------------- BOOKINGS (Reservas) --------------------
// Evita NOT_FOUND en la app. Por ahora devuelve vacío (estable).
app.get("/api/bookings", async (_req, res) => {
  try {
    if (!dbOk) {
      return res.json({
        ok: true,
        bookings: [],
        db: false,
        message: "DB offline, devolviendo vacío",
      });
    }

    // Todavía no hay modelo Booking → devolvemos vacío
    return res.json({
      ok: true,
      bookings: [],
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "BOOKINGS_ERROR",
      message: err?.message || "Error",
    });
  }
});

app.get("/", (_req, res) => res.send("IGUIDEU backend OK"));

app.use((_req, res) => res.status(404).json({ ok: false, error: "NOT_FOUND" }));

app.use((err, _req, res, _next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({ ok: false, error: "SERVER_ERROR", message: err?.message || "Error" });
});

// -------------------- LISTEN --------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server ON → http://0.0.0.0:${PORT}`);
});
