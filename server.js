// server.js – Backend 24 (I GUIDE U)
// - MongoDB conectado con tu URI real (iguideu20)
// - 3 guías estáticas (Maya, Arun, Sofía)
// - Regla 1–24h (hora / día / promo 12h / full 24h)
// - /api/guides
// - /api/payments/create-checkout (test o reserva real)
// - /api/admin/bookings
// - /api/stripe/webhook (Stripe CLI compatible)

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import Stripe from "stripe";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config(); // 👈 Carga .env

const app = express();
const PORT = 4026;

// ========================= ENV / CONFIG =========================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://iguideu23_user:Lorenza2727@iguideu-db.sfgtfz8.mongodb.net/iguideu20?retryWrites=true&w=majority&appName=iguideu-db";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:4026";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY) {
  console.error("❌ Falta STRIPE_SECRET_KEY en el entorno (.env)");
  process.exit(1);
}
if (!STRIPE_WEBHOOK_SECRET) {
  console.warn(
    "⚠️ Falta STRIPE_WEBHOOK_SECRET en el entorno (.env). El webhook no va a validar la firma."
  );
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

// CORS primero
app.use(
  cors({
    origin: ["http://localhost:5181", "http://127.0.0.1:5181"],
  })
);

// ======================= STRIPE WEBHOOK (RAW) =======================
// Importante: va ANTES de express.json()
app.post(
  "/api/stripe/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    if (!STRIPE_WEBHOOK_SECRET) {
      console.warn("⚠️ Webhook recibido pero no hay STRIPE_WEBHOOK_SECRET configurado.");
      return res.status(200).json({ received: true, warning: "no-secret" });
    }

    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const bookingId = session.metadata?.bookingId;

        if (bookingId) {
          console.log("✅ Webhook: pago completado →", bookingId);
          await Booking.findByIdAndUpdate(bookingId, {
            paymentStatus: "paid",
          });
        }
      } else {
        console.log("ℹ️ Webhook recibido:", event.type);
      }

      res.json({ received: true });
    } catch (err) {
      console.error("❌ Error manejando webhook:", err);
      res.status(500).send("Webhook handler error");
    }
  }
);

// Ahora sí, JSON normal
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================================================
// ====================== MONGOOSE SCHEMAS ========================
// ===============================================================

const bookingSchema = new mongoose.Schema(
  {
    guideId: { type: String, required: true },
    guideName: { type: String, required: true },
    hours: { type: Number, required: true },

    durationType: {
      type: String,
      enum: ["HOURS", "DAY", "PROMO_12H", "FULL_DAY_24H"],
      required: true,
    },

    total: { type: Number, required: true },
    amountUsd: { type: Number },

    travelerName: { type: String },
    travelerEmail: { type: String },
    travelDate: { type: Date },
    notes: { type: String },

    stripeCheckoutSessionId: { type: String },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);

// ===============================================================
// ====================== PRICE CALCULATION =======================
// ===============================================================

function calculatePrice(guide, hours) {
  const hour = guide.hourlyRate ?? guide.priceHour;
  const day = guide.dailyRate ?? guide.priceDay;

  const promo12 = guide.promo12hRate ?? guide.promo12h;
  const full24 = guide.fullDay24hRate ?? guide.fullDay24h;

  if (!hour || !day) {
    throw new Error("Tarifas inválidas para el guía");
  }

  if (hours <= 7) return { total: hour * hours, type: "HOURS" };
  if (hours === 8) return { total: day, type: "DAY" };

  if (hours >= 9 && hours <= 12) {
    if (promo12) return { total: promo12, type: "PROMO_12H" };
    return { total: day + (hours - 8) * hour, type: "HOURS" };
  }

  if (hours >= 13 && hours <= 24) {
    if (full24) return { total: full24, type: "FULL_DAY_24H" };
    return { total: day * 2, type: "FULL_DAY_24H" };
  }

  throw new Error("Horas fuera de rango (1–24)");
}

// ===============================================================
// ========================= STATIC GUIDES ========================
// ===============================================================

const guides = [
  {
    _id: "maya-kathmandu",
    id: "maya-kathmandu",
    name: "Maya – Kathmandu Cultural Guide",
    city: "Kathmandu",
    country: "Nepal",
    rating: 5,
    hourlyRate: 15,
    dailyRate: 95,
    promo12hRate: 180,
    fullDay24hRate: 190,
    priceHour: 15,
    priceDay: 95,
    promo12h: 180,
    fullDay24h: 190,
    languages: ["English", "Nepali"],
    description:
      "Recorridos culturales por el Valle de Katmandú, Durbar Square, Boudhanath y vida local.",
  },
  {
    _id: "arun-bangkok",
    id: "arun-bangkok",
    name: "Arun – Bangkok Local Guide",
    city: "Bangkok",
    country: "Tailandia",
    rating: 4.8,
    hourlyRate: 18,
    dailyRate: 110,
    promo12hRate: 195,
    fullDay24hRate: 210,
    priceHour: 18,
    priceDay: 110,
    promo12h: 195,
    fullDay24h: 210,
    languages: ["English", "Thai"],
    description: "Templos, street food, mercados nocturnos y vida local.",
  },
  {
    _id: "sofia-buenosaires",
    id: "sofia-buenosaires",
    name: "Sofía – Experta en Buenos Aires",
    city: "Buenos Aires",
    country: "Argentina",
    rating: 4.9,
    hourlyRate: 20,
    dailyRate: 120,
    promo12hRate: 210,
    fullDay24hRate: 230,
    priceHour: 20,
    priceDay: 120,
    promo12h: 210,
    fullDay24h: 230,
    languages: ["Spanish", "English"],
    description:
      "Recorridos históricos, cultura porteña y barrios clásicos de Buenos Aires.",
  },
];

// ===============================================================
// ======================== API ENDPOINTS =========================
// ===============================================================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: "development",
    db: mongoose.connection.readyState === 1,
    stripeKeyLoaded: !!STRIPE_SECRET_KEY,
  });
});

app.get("/api/guides", (req, res) => {
  res.json(guides);
});

// ===============================================================
// ================ CREATE CHECKOUT + CREATE BOOKING ==============
// ===============================================================

app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    const {
      guideId,
      hours,
      travelerName,
      travelerEmail,
      travelDate,
      notes,
    } = req.body || {};

    // TEST PAYMENT (USD 10) – botón "Test pago Stripe (USD 10)"
    if (!guideId || !hours) {
      const testAmount = 10;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: travelerEmail || "test+frontend@iguideu.com",
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: testAmount * 100,
              product_data: {
                name: "Test pago Stripe (USD 10)",
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${PUBLIC_BASE_URL}/api/payments/success?mode=test`,
        cancel_url: `${PUBLIC_BASE_URL}/api/payments/cancel?mode=test`,
        metadata: { mode: "test" },
      });

      return res.json({
        ok: true,
        mode: "test",
        amountUsd: testAmount,
        stripeCheckoutSessionId: session.id,
        url: session.url,
      });
    }

    // BOOKING REAL

    const guide =
      guides.find((g) => g.id === guideId) ||
      guides.find((g) => g._id === guideId);

    if (!guide) {
      return res
        .status(400)
        .json({ ok: false, error: "Guía no encontrado (guideId inválido)" });
    }

    const h = parseInt(hours, 10);
    if (!Number.isInteger(h) || h < 1 || h > 24) {
      return res
        .status(400)
        .json({ ok: false, error: "Horas inválidas (1–24)" });
    }

    const { total, type } = calculatePrice(guide, h);

    const travelerEmailFinal =
      travelerEmail && travelerEmail.trim().length > 0
        ? travelerEmail
        : "test+booking@iguideu.com";

    const booking = await Booking.create({
      guideId: guide.id,
      guideName: guide.name,
      hours: h,
      durationType: type,
      total,
      amountUsd: total,
      travelerName: travelerName || "Demo Traveler Frontend",
      travelerEmail: travelerEmailFinal,
      travelDate: travelDate ? new Date(travelDate) : undefined,
      notes: notes || "Reserva creada desde frontend simple",
      paymentStatus: "pending",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: travelerEmailFinal,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: total * 100,
            product_data: {
              name: `${guide.name} – ${h}h (${type})`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${PUBLIC_BASE_URL}/api/payments/success?mode=booking&bookingId=${booking._id}`,
      cancel_url: `${PUBLIC_BASE_URL}/api/payments/cancel?mode=booking&bookingId=${booking._id}`,
      metadata: {
        mode: "booking",
        bookingId: booking._id.toString(),
      },
    });

    booking.stripeCheckoutSessionId = session.id;
    await booking.save();

    return res.json({
      ok: true,
      mode: "booking",
      bookingId: booking._id,
      amountUsd: total,
      durationType: type,
      url: session.url,
      stripeCheckoutSessionId: session.id,
    });
  } catch (err) {
    console.error("❌ ERROR create-checkout:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===============================================================
// ========================== ADMIN PANEL =========================
// ===============================================================

app.get("/api/admin/bookings", async (req, res) => {
  try {
    if (req.headers["x-admin-key"] !== "ClaveUltraSecreta2025") {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json({ ok: true, bookings });
  } catch (err) {
    console.error("❌ Error admin bookings:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===============================================================
// ========================= START SERVER =========================
// ===============================================================

console.log(
  "🔑 STRIPE_SECRET_KEY preview:",
  STRIPE_SECRET_KEY.slice(0, 10) + "...(OK)"
);
console.log("DEBUG MONGO_URI:", MONGO_URI);

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado correctamente"))
  .catch((err) => console.error("❌ Error MongoDB:", err));

app.listen(PORT, () => {
  console.log(`🚀 Backend 24 corriendo en http://0.0.0.0:${PORT}`);
});
