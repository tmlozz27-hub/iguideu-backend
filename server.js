// ========================================================
// I GUIDE U – SERVER BACKEND 24 (estable)
// ========================================================

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import Guide from "./models/Guide.js";
import Booking from "./models/Booking.js";
import Stripe from "stripe";

// ========================================================
// ENV
// ========================================================
import dotenv from "dotenv";
dotenv.config();

const app = express();

// Para Stripe webhook (RAW BODY primero)
app.use(
  "/api/stripe/webhook",
  bodyParser.raw({ type: "application/json" })
);

// Para todo lo demás → JSON normal
app.use(bodyParser.json());

// ========================================================
// CORS
// ========================================================
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

// ========================================================
// DEBUG ENV
// ========================================================
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET;
const stripe = Stripe(STRIPE_SECRET_KEY || "");

console.log("🔑 STRIPE_SECRET_KEY preview:", STRIPE_SECRET_KEY ? "OK" : "NOT_SET");
console.log("DEBUG MONGO_URI prefix:", process.env.MONGO_URI?.substring(0, 25) || "(no definido)");
console.log("DEBUG DB_NAME:", process.env.DB_NAME);

// ========================================================
// Conexión MongoDB
// ========================================================
if (!process.env.MONGO_URI) {
  console.error("❌ Error: MONGO_URI no está definido en process.env");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI, {
    dbName: process.env.DB_NAME,
  })
  .then(() => console.log("✅ MongoDB conectado → DB:", process.env.DB_NAME))
  .catch((err) => {
    console.error("❌ Error MongoDB:", err);
    process.exit(1);
  });

// ========================================================
// HEALTH
// ========================================================
app.get("/api/health", (req, res) => {
  return res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    port: process.env.PORT || 4026,
    publicBaseUrl: process.env.PUBLIC_BASE_URL,
    db: true,
    stripeKeyLoaded: !!STRIPE_SECRET_KEY,
  });
});

// ========================================================
// GET GUIDES
// ========================================================
app.get("/api/guides", async (req, res) => {
  try {
    const guides = await Guide.find().lean();

    return res.json({
      ok: true,
      guides,
    });
  } catch (err) {
    console.error("[ERROR] GET /api/guides:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ========================================================
// ADMIN KEY
// ========================================================
const ADMIN_KEY = process.env.ADMIN_KEY || "ClaveUltraSecreta2025";

// ========================================================
// SEED GUIDES (ADMIN)
// ========================================================
app.post("/api/admin/seed-guides", async (req, res) => {
  try {
    if (req.headers["x-admin-key"] !== ADMIN_KEY)
      return res.status(401).json({ ok: false, error: "No autorizado" });

    console.log("🛠 [ADMIN] Ejecutando seed de guías…");

    const seedData = [
      {
        name: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        hourlyRate: 18,
        dailyRate: 110,
        rating: 4.8,
        languages: ["English", "Thai"],
        description: "Templos · Street food · Mercados nocturnos",
        guideType: "INDEPENDENT",
        identityVerified: false,
      },
      {
        name: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        hourlyRate: 15,
        dailyRate: 95,
        rating: 5,
        languages: ["English", "Nepali"],
        description: "Durbar Square, Boudhanath y experiencia local en el valle",
        guideType: "CERTIFIED",
        identityVerified: true,
      },
      {
        name: "Sofía – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        hourlyRate: 20,
        dailyRate: 120,
        rating: 4.9,
        languages: ["Spanish", "English"],
        description: "Recorridos históricos y culturales por Buenos Aires",
        guideType: "CERTIFIED",
        identityVerified: true,
      },
    ];

    const deleted = await Guide.deleteMany({});
    const inserted = await Guide.insertMany(seedData);

    return res.json({
      ok: true,
      deleted: deleted.deletedCount,
      inserted: inserted.length,
      guides: inserted,
    });
  } catch (err) {
    console.error("[ERROR] /api/admin/seed-guides:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ========================================================
// ADMIN – VER RESERVAS
// ========================================================
app.get("/api/admin/bookings", async (req, res) => {
  try {
    if (req.headers["x-admin-key"] !== ADMIN_KEY)
      return res.status(401).json({ ok: false, error: "No autorizado" });

    const filter = {};
    if (req.query.email) filter.travelerEmail = req.query.email;

    const bookings = await Booking.find(filter).sort({ createdAt: -1 }).lean();

    return res.json({
      ok: true,
      count: bookings.length,
      value: bookings,
    });
  } catch (err) {
    console.error("[ERROR] /api/admin/bookings:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ========================================================
// STRIPE TEST CHECKOUT
// ========================================================
app.post("/api/payments/test-checkout", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Pago test I GUIDE U" },
            unit_amount: 1000,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.PUBLIC_BASE_URL}/stripe-success.html`,
      cancel_url: `${process.env.PUBLIC_BASE_URL}/stripe-cancel.html`,
    });

    return res.json({ ok: true, url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("[ERROR] /api/payments/test-checkout:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ========================================================
// CREATE CHECKOUT REAL DE RESERVA
// ========================================================
app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    const { guideId, guideName, city, country, hourlyRate, dailyRate, hours, durationType } =
      req.body;

    const travelerEmail = "test+frontend@iguideu.com"; // demo traveler

    const totalUsd = hours * hourlyRate;

    const booking = await Booking.create({
      guideId,
      guideName,
      city,
      country,
      hourlyRate,
      dailyRate,
      hours,
      durationType,
      totalUsd,
      travelerEmail,
      paymentStatus: "pending",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: travelerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${guideName} – Reserva I GUIDE U`,
              description: `${hours} hs en ${city}, ${country} · Tipo: ${durationType}`,
            },
            unit_amount: Math.round(totalUsd * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingId: booking._id.toString(),
      },
      success_url: `${process.env.PUBLIC_BASE_URL}/stripe-success.html`,
      cancel_url: `${process.env.PUBLIC_BASE_URL}/stripe-cancel.html`,
    });

    return res.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      totalUsd,
    });
  } catch (err) {
    console.error("[ERROR] /api/payments/create-checkout:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ========================================================
// STRIPE WEBHOOK
// ========================================================
app.post("/api/stripe/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("❌ Webhook signature error:", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookingId = session.metadata.bookingId;

    await Booking.findByIdAndUpdate(bookingId, {
      paymentStatus: "paid",
    });

    console.log("💰 Reserva marcada como pagada:", bookingId);
  }

  res.json({ received: true });
});

// ========================================================
// START SERVER
// ========================================================
const PORT = process.env.PORT || 4026;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend 24 corriendo en http://0.0.0.0:${PORT}`);
});
