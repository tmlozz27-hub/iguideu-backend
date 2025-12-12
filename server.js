// ======================================================
// I GUIDE U - Backend24 - server.js (ESTABLE + Stripe Webhook + Admin Tools)
// ======================================================

import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import Stripe from "stripe";
import bodyParser from "body-parser";

dotenv.config();

// ======================================================
// ENTORNO
// ======================================================
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = Number(process.env.PORT || 4026);

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;

const CLIENT_URL =
  process.env.CLIENT_URL ||
  process.env.FRONTEND_URL ||
  "http://127.0.0.1:5181";

// 🔑 Admin key (acepta dos nombres)
const ADMIN_KEY =
  process.env.ADMIN_KEY ||
  process.env.ADMIN_API_KEY ||
  "ClaveUltraSecreta2025";

// ======================================================
// STRIPE
// ======================================================
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// ======================================================
// EXPRESS
// ======================================================
const app = express();

// CORS (simple y sin credenciales)
app.use(cors());

// ------------------------------------------------------
// Stripe Webhook (raw body) - IMPORTANTE: antes de express.json()
// ------------------------------------------------------
app.post(
  "/api/stripe/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      if (!stripe || !STRIPE_WEBHOOK_SECRET) {
        console.warn("⚠️ Webhook recibido pero Stripe no configurado.");
        return res.status(200).send("ok");
      }

      const sig = req.headers["stripe-signature"];
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );

      // ✅ Evento clave: checkout completado
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        const bookingId = session?.metadata?.bookingId;
        const paymentStatus = session?.payment_status; // 'paid' en general
        const sessionId = session?.id;
        const paymentIntent = session?.payment_intent || null;
        const customerEmail = session?.customer_details?.email || null;

        console.log("✅ Stripe checkout.session.completed:", {
          bookingId,
          paymentStatus,
          sessionId,
        });

        if (bookingId && paymentStatus === "paid") {
          await Booking.findByIdAndUpdate(
            bookingId,
            {
              status: "PAID",
              stripeCheckoutSessionId: sessionId,
              stripePaymentIntentId: paymentIntent,
              stripeCustomerEmail: customerEmail,
            },
            { new: true }
          );
        }
      }

      return res.json({ received: true });
    } catch (err) {
      console.error("❌ Error webhook Stripe:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// JSON normal para el resto
app.use(express.json());

// ======================================================
// LOGS (sin exponer secretos completos)
// ======================================================
console.log("🔑 ADMIN_KEY cargada:", ADMIN_KEY ? "OK" : "NO_SET");
console.log(
  "🔑 STRIPE_KEY preview:",
  STRIPE_SECRET_KEY ? STRIPE_SECRET_KEY.slice(0, 8) + "..." : "NOT_SET"
);
console.log(
  "DEBUG MONGO_URI prefix:",
  process.env.MONGO_URI ? process.env.MONGO_URI.slice(0, 30) : "NO_SET"
);

const DB_NAME =
  process.env.DB_NAME || process.env.MONGODB_DB_NAME || "iguideu20";

console.log("DEBUG DB_NAME:", DB_NAME);

// ======================================================
// MONGO
// ======================================================
if (!process.env.MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI NO DEFINIDO.");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI, { dbName: DB_NAME })
  .then(() => console.log(`✅ MongoDB conectado → DB: ${DB_NAME}`))
  .catch((err) => console.error("❌ Error MongoDB:", err));

// ======================================================
// MODELOS
// ======================================================
const guideSchema = new mongoose.Schema(
  {
    name: String,
    city: String,
    country: String,
    hourlyRateUsd: Number,
    dayRateUsd: Number,
    fullDay24hRateUsd: Number,
    languages: [String],
    rating: Number,
    description: String,
  },
  { timestamps: true }
);

const bookingExtensionSchema = new mongoose.Schema(
  {
    fromHours: Number,
    toHours: Number,
    extraHours: Number,
    extraAmountUsd: Number,
    newDurationType: String,
    stripeCheckoutSessionId: String,
    paymentStatus: String,
  },
  { timestamps: true, _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    guideId: { type: mongoose.Schema.Types.ObjectId, ref: "Guide" },
    guideName: String,
    travelerEmail: String,
    durationType: String,
    hours: Number,
    totalAmountUsd: Number,
    currency: { type: String, default: "USD" },

    // status en MAYUS (PENDING / PAID)
    status: { type: String, default: "PENDING" },

    stripeCheckoutSessionId: String,

    // tracking real
    stripePaymentIntentId: String,
    stripeCustomerEmail: String,

    extensions: [bookingExtensionSchema],
  },
  { timestamps: true }
);

const Guide = mongoose.models.Guide || mongoose.model("Guide", guideSchema);
const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

// Log count guides en startup
mongoose.connection.once("open", async () => {
  try {
    const count = await mongoose.connection.db
      .collection("guides")
      .countDocuments();
    console.log("📊 Guides count at startup:", count);
  } catch (err) {
    console.error("❌ Error contando guías:", err);
  }
});

// ======================================================
// RUTAS
// ======================================================

app.get("/", (req, res) => {
  res.send("I GUIDE U Backend OK");
});

// Health
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: NODE_ENV,
    port: String(PORT),
    publicBaseUrl: PUBLIC_BASE_URL,
    db: mongoose.connection.readyState === 1,
    stripeKeyLoaded: Boolean(STRIPE_SECRET_KEY),
  });
});

// Guides
app.get("/api/guides", async (req, res) => {
  try {
    const col = mongoose.connection.db.collection("guides");
    const guides = await col.find({}).toArray();
    res.json({ ok: true, guides });
  } catch (err) {
    console.error("❌ Error en /api/guides:", err);
    res.status(500).json({ ok: false, error: "Error listing guides" });
  }
});

// BOOKINGS – Crear reserva
app.post("/api/bookings/create", async (req, res) => {
  try {
    const {
      guideId,
      guideName,
      travelerEmail,
      durationType,
      hours,
      totalAmountUsd,
      currency,
    } = req.body;

    if (!guideId || !travelerEmail || !durationType || !totalAmountUsd) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const booking = await Booking.create({
      guideId,
      guideName,
      travelerEmail,
      durationType,
      hours,
      totalAmountUsd,
      currency: currency || "USD",
      status: "PENDING",
    });

    res.json({ ok: true, booking });
  } catch (err) {
    console.error("❌ Error creating booking:", err);
    res.status(500).json({ ok: false, error: "Booking creation error" });
  }
});

// Stripe – Checkout REAL por bookingId
app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ ok: false, error: "Stripe not configured" });
    }

    const { bookingId } = req.body || {};
    if (!bookingId) {
      return res.status(400).json({ ok: false, error: "Missing bookingId" });
    }

    const booking = await Booking.findById(bookingId).lean();
    if (!booking) {
      return res.status(404).json({ ok: false, error: "Booking not found" });
    }

    const amountUsd = Number(booking.totalAmountUsd || 0);
    if (!amountUsd || amountUsd <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid booking amount" });
    }

    const unitAmount = Math.round(amountUsd * 100);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: booking.travelerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Reserva I GUIDE U – ${booking.guideName || "Guía"}`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingId: String(booking._id),
      },
      success_url: `${CLIENT_URL}/stripe-success?bookingId=${booking._id}`,
      cancel_url: `${CLIENT_URL}/stripe-cancel?bookingId=${booking._id}`,
    });

    await Booking.findByIdAndUpdate(booking._id, {
      stripeCheckoutSessionId: session.id,
    });

    res.json({ ok: true, url: session.url, bookingId: String(booking._id) });
  } catch (err) {
    console.error("❌ Stripe checkout error:", err);
    res.status(500).json({ ok: false, error: "Stripe error" });
  }
});

// ADMIN – Seed guías (con admin key)
app.post("/api/admin/seed-guides", async (req, res) => {
  try {
    const incoming = req.headers["x-admin-key"];
    if (incoming !== ADMIN_KEY) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    await Guide.deleteMany({});
    const guides = await Guide.insertMany([
      {
        name: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        hourlyRateUsd: 18,
        dayRateUsd: 110,
        fullDay24hRateUsd: 180,
        languages: ["English", "Thai"],
        rating: 4.8,
        description: "Experiencias locales en templos, mercados y vida nocturna.",
      },
      {
        name: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        hourlyRateUsd: 15,
        dayRateUsd: 95,
        fullDay24hRateUsd: 160,
        languages: ["English", "Nepali"],
        rating: 5.0,
        description: "Cultura, templos y recorridos locales en Katmandú.",
      },
      {
        name: "Sofia – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        hourlyRateUsd: 20,
        dayRateUsd: 120,
        fullDay24hRateUsd: 200,
        languages: ["Spanish", "English"],
        rating: 4.9,
        description: "Historia, cultura y gastronomía porteña.",
      },
    ]);

    res.json({ ok: true, inserted: guides.length, guides });
  } catch (err) {
    console.error("❌ Error seed:", err);
    res.status(500).json({ ok: false, error: "Seed error" });
  }
});

// ADMIN – Ver bookings (con admin key)
app.get("/api/admin/bookings", async (req, res) => {
  try {
    const incoming = req.headers["x-admin-key"];
    if (incoming !== ADMIN_KEY) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const { email } = req.query;
    const filter = email ? { travelerEmail: email } : {};

    const bookings = await Booking.find(filter).lean();
    if (!bookings.length) {
      return res.status(404).json({ ok: false, message: "No bookings found" });
    }

    res.json({ ok: true, bookings });
  } catch (err) {
    console.error("❌ Booking query error:", err);
    res.status(500).json({ ok: false, error: "Booking query error" });
  }
});

// ======================================================
// ADMIN – Limpiar bookings PENDING de un email (seguro)
// Borra SOLO status PENDING/pending. NO toca PAID.
// Requiere x-admin-key.
// ======================================================
app.post("/api/admin/cleanup-pending", async (req, res) => {
  try {
    const incoming = req.headers["x-admin-key"];
    if (incoming !== ADMIN_KEY) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ ok: false, error: "Missing email" });
    }

    const result = await Booking.deleteMany({
      travelerEmail: email,
      status: { $in: ["PENDING", "pending"] },
    });

    res.json({ ok: true, deleted: result.deletedCount, email });
  } catch (err) {
    console.error("❌ cleanup-pending error:", err);
    res.status(500).json({ ok: false, error: "Cleanup error" });
  }
});

// ======================================================
// START
// ======================================================
app.listen(PORT, () => {
  console.log(`🚀 Backend 24 corriendo en http://0.0.0.0:${PORT}`);
});
