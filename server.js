// server.js - Backend 24 estable (I GUIDE U)
// --------------------------------------------------
// Carga de dependencias y configuración básica
// --------------------------------------------------
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import Stripe from "stripe";
import bodyParser from "body-parser";

dotenv.config();

// --------------------------------------------------
// Variables de entorno
// --------------------------------------------------
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 4026;

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;

const CLIENT_URL =
  process.env.CLIENT_URL ||
  process.env.FRONTEND_URL ||
  "http://127.0.0.1:5181";

const ADMIN_KEY = process.env.ADMIN_KEY || "ClaveUltraSecreta2025";

const MONGO_URI = process.env.MONGO_URI;

// 🔒 Forzamos DB_NAME estable con fallback
const DB_NAME =
  process.env.DB_NAME || process.env.MONGODB_DB_NAME || "iguideu20";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// --------------------------------------------------
// App Express
// --------------------------------------------------
const app = express();

// CORS dinámico desde env
function getCorsOrigins() {
  const raw = process.env.CORS_ORIGINS;
  if (!raw) {
    return [CLIENT_URL];
  }

  try {
    // Si viene como JSON array
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {
    // Si NO es JSON, lo tratamos como lista separada por comas
  }

  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

const allowedOrigins = getCorsOrigins();

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Webhook Stripe necesita raw body ANTES de express.json
app.post(
  "/api/stripe/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      console.warn("⚠️ Webhook Stripe recibido pero STRIPE no está configurado.");
      return res.status(200).send("ok");
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
      console.error("❌ Error verificando webhook Stripe:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Podés extender según tipos de evento
    console.log("📦 Evento Stripe recibido:", event.type);

    // Ejemplo: completar booking, etc.
    // if (event.type === "checkout.session.completed") { ... }

    res.json({ received: true });
  }
);

// El resto usa JSON normal
app.use(express.json());

// --------------------------------------------------
// Logs de arranque
// --------------------------------------------------
console.log(
  "🔑 STRIPE_SECRET_KEY preview:",
  STRIPE_SECRET_KEY ? STRIPE_SECRET_KEY.slice(0, 8) + "..." : "NOT_SET"
);
console.log(
  "DEBUG MONGO_URI prefix:",
  MONGO_URI ? MONGO_URI.slice(0, 20) : "NO_SET"
);
console.log("DEBUG DB_NAME:", DB_NAME);

// --------------------------------------------------
// Conexión a MongoDB
// --------------------------------------------------
if (!MONGO_URI) {
  console.error("❌ MONGO_URI no está definido en las variables de entorno.");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    dbName: DB_NAME,
  })
  .then(() => {
    console.log(`✅ MongoDB conectado → DB: ${DB_NAME}`);
  })
  .catch((err) => {
    console.error("❌ Error MongoDB:", err);
  });

// --------------------------------------------------
// Modelos básicos (Guide y Booking)
// --------------------------------------------------
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
    durationType: String, // HOURS, FULL_DAY, FULL_DAY_24H, etc.
    hours: Number,
    totalAmountUsd: Number,
    currency: { type: String, default: "USD" },
    status: { type: String, default: "pending" }, // pending, paid, cancelled
    stripeCheckoutSessionId: String,
    extensions: [bookingExtensionSchema],
  },
  { timestamps: true }
);

const Guide =
  mongoose.models.Guide || mongoose.model("Guide", guideSchema);

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

// --------------------------------------------------
// Rutas
// --------------------------------------------------

// Health check
app.get("/api/health", async (req, res) => {
  const dbReady = mongoose.connection.readyState === 1; // 1 = connected
  res.json({
    ok: true,
    env: NODE_ENV,
    port: String(PORT),
    publicBaseUrl: PUBLIC_BASE_URL,
    db: dbReady,
    stripeKeyLoaded: Boolean(STRIPE_SECRET_KEY),
  });
});

// Listar guías
app.get("/api/guides", async (req, res) => {
  try {
    const guides = await Guide.find().lean();
    res.json({ ok: true, guides });
  } catch (err) {
    console.error("❌ Error al listar guías:", err);
    res.status(500).json({ ok: false, error: "Error listing guides" });
  }
});

// Admin: seed de guías
app.post("/api/admin/seed-guides", async (req, res) => {
  try {
    const headerKey = req.headers["x-admin-key"];
    if (headerKey !== ADMIN_KEY) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    console.log("🧹 Borrando guías existentes...");
    const deleted = await Guide.deleteMany({});

    console.log("🌱 Insertando guías de seed...");
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
        description:
          "Recorridos locales por templos, mercados y vida nocturna en Bangkok.",
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
        description:
          "Durbar Square, Boudhanath, templos y cultura local en el valle de Katmandú.",
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
        description:
          "Recorridos históricos, culturales y gastronómicos por Buenos Aires.",
      },
    ]);

    console.log(
      `✅ Seed completo. Guías insertadas: ${guides.length} (borradas: ${deleted.deletedCount})`
    );

    res.json({
      ok: true,
      deleted: deleted.deletedCount,
      inserted: guides.length,
      guides,
    });
  } catch (err) {
    console.error("❌ Error en /api/admin/seed-guides:", err);
    res.status(500).json({ ok: false, error: "Seed error" });
  }
});

// Admin: ver bookings (opcionalmente por email)
app.get("/api/admin/bookings", async (req, res) => {
  try {
    const headerKey = req.headers["x-admin-key"];
    if (headerKey !== ADMIN_KEY) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const { email } = req.query;
    const query = {};

    if (email) {
      query.travelerEmail = email;
    }

    const bookings = await Booking.find(query).lean().sort({ createdAt: -1 });

    if (!bookings.length) {
      return res
        .status(404)
        .json({ ok: false, message: "No bookings found for this filter" });
    }

    res.json({ ok: true, bookings });
  } catch (err) {
    console.error("❌ Error en /api/admin/bookings:", err);
    res.status(500).json({ ok: false, error: "Admin bookings error" });
  }
});

// --------------------------------------------------
// Pagos Stripe (demo simple USD 10)
// --------------------------------------------------
app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    if (!stripe || !STRIPE_SECRET_KEY) {
      console.error("❌ Stripe no está configurado en el backend.");
      return res
        .status(500)
        .json({ ok: false, error: "Stripe not configured" });
    }

    console.log("[INFO] Creando Checkout Stripe (USD 10) ...");

    const successUrl = `${CLIENT_URL}/stripe-success`;
    const cancelUrl = `${CLIENT_URL}/stripe-cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Test pago Stripe (USD 10)",
            },
            unit_amount: 1000, // 10 USD
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    console.log("[OK] Checkout creado. Session ID:", session.id);

    res.json({
      ok: true,
      stripeCheckoutSessionId: session.id,
      url: session.url,
    });
  } catch (err) {
    console.error("❌ Error en /api/payments/create-checkout:", err);
    res.status(500).json({ ok: false, error: "Stripe checkout error" });
  }
});

// --------------------------------------------------
// Arranque del servidor
// --------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Backend 24 corriendo en http://0.0.0.0:${PORT}`);
});
