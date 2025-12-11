// server.js - I GUIDE U Backend 24 (FINAL)
// Express + MongoDB + Stripe + Admin Seed + Bookings

import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import Stripe from "stripe";
import path from "path";
import { fileURLToPath } from "url";

// Routers
import guidesRouter from "./routes/guides.js";
import paymentsRouter from "./routes/payments.js";

// Models
import Guide from "./models/Guide.js";
import Booking from "./models/Booking.js";

// Path helpers (para Stripe success/cancel)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express app
const app = express();

// Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "NOT_SET";
console.log("🔑 STRIPE_SECRET_KEY preview:", STRIPE_SECRET_KEY.slice(0, 10) + "...");

// CORS
const ALLOWED_ORIGINS = [
  "http://localhost:5181",
  "http://127.0.0.1:5181",
  "http://192.168.0.4:5181",
  "https://iguideu-frontend.onrender.com",
  "https://iguideu.com",
];

app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST"],
}));

// Para JSON normal
app.use(express.json());

// Webhook Stripe → **RAW BODY**
app.use(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" })
);

// Conectar a MongoDB
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "iguideu20";

console.log("DEBUG MONGO_URI prefix:", MONGO_URI ? MONGO_URI.slice(0, 30) + "..." : "(no definido)");
console.log("DEBUG DB_NAME:", DB_NAME);

if (!MONGO_URI) {
  console.error("❌ Error: MONGO_URI no está definido en process.env");
  process.exit(1);
}

mongoose.connect(MONGO_URI, {
  dbName: DB_NAME,
})
  .then(() => console.log(`✅ MongoDB conectado → DB: ${DB_NAME}`))
  .catch(err => {
    console.error("❌ Error MongoDB:", err);
    process.exit(1);
  });

// ------------------------------
// HEALTH CHECK
// ------------------------------
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    port: process.env.PORT || 4026,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
    db: mongoose.connection.readyState === 1,
    stripeKeyLoaded: STRIPE_SECRET_KEY !== "NOT_SET",
  });
});

// ------------------------------
// ADMIN: seed-guides en producción
// ------------------------------
app.post("/api/admin/seed-guides", async (req, res) => {
  try {
    if (req.headers["x-admin-key"] !== "ClaveUltraSecreta2025") {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    console.log("🛠 [ADMIN] Ejecutando seed de guías…");

    const countBefore = await Guide.countDocuments();
    await Guide.deleteMany({});

    const guides = [
      {
        id: "arun-bangkok",
        name: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        hourlyRate: 18,
        dailyRate: 110,
        rating: 4.8,
        description: "Templos · Street food · Mercados nocturnos",
        languages: ["English", "Thai"],
        guideType: "INDEPENDENT",
        identityVerified: false,
      },
      {
        id: "maya-kathmandu",
        name: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        hourlyRate: 15,
        dailyRate: 95,
        rating: 5,
        description: "Durbar Square, Boudhanath y experiencia local",
        languages: ["English", "Nepali"],
        guideType: "CERTIFIED",
        identityVerified: true,
      },
      {
        id: "sofia-buenosaires",
        name: "Sofía – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        hourlyRate: 20,
        dailyRate: 120,
        rating: 4.9,
        description: "Recorridos históricos y culturales",
        languages: ["Spanish", "English"],
        guideType: "CERTIFIED",
        identityVerified: true,
      },
    ];

    const inserted = await Guide.insertMany(guides);

    console.log(`✅ [ADMIN] Seed listo. Borrados: ${countBefore}, insertados: ${inserted.length}`);

    res.json({
      ok: true,
      deleted: countBefore,
      inserted: inserted.length,
    });

  } catch (e) {
    console.error("❌ Error seed:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ------------------------------
// API ROUTES
// ------------------------------
app.use("/api/guides", guidesRouter);
app.use("/api/payments", paymentsRouter);

// ------------------------------
// WEBHOOK STRIPE
// ------------------------------
app.post("/api/stripe/webhook", async (req, res) => {
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Evento: pago completado
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const sessionId = session.id;

    console.log("🎉 Webhook: payment completed →", sessionId);

    await Booking.findOneAndUpdate(
      { stripeSessionId: sessionId },
      { paymentStatus: "paid" }
    );
  }

  res.json({ received: true });
});

// ------------------------------
// STATIC FILES (Stripe success/cancel)
// ------------------------------
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------
// PORT
// ------------------------------
const PORT = process.env.PORT || 4026;

app.listen(PORT, () => {
  console.log(`🚀 Backend 24 corriendo en http://0.0.0.0:${PORT}`);
});
