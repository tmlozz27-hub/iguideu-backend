require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");

// =============================
// 🔐 Validar variables de entorno
// =============================
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("❌ Falta MONGO_URI en .env");
  process.exit(1);
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("❌ Falta STRIPE_SECRET_KEY en .env");
  process.exit(1);
}

const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!stripeWebhookSecret) {
  console.warn("⚠ Falta STRIPE_WEBHOOK_SECRET en .env (el webhook no funcionará bien)");
}

const adminApiKey = process.env.ADMIN_API_KEY;
if (!adminApiKey) {
  console.warn("⚠ Falta ADMIN_API_KEY en .env (el endpoint admin será inútil)");
}

const stripe = require("stripe")(stripeSecretKey);

const app = express();

// =============================
// 🌍 CORS + Helmet (seguridad)
// =============================
const allowedOrigins = [
  "http://127.0.0.1:5181",
  "http://localhost:5181",
  "http://192.168.0.4:5181",
];

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
  })
);

// =============================
// 🟣 Webhook Stripe (usa body RAW)
//  -> DEBE IR ANTES DE express.json()
// =============================
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripeWebhookSecret) {
      console.error("❌ Webhook recibido pero falta STRIPE_WEBHOOK_SECRET");
      return res.status(500).send("Config error");
    }

    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        stripeWebhookSecret
      );
    } catch (err) {
      console.error("❌ Firma Webhook inválida:", err.message);
      return res.status(400).send("Firma inválida");
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const bookingId = session.metadata && session.metadata.bookingId;

        if (!bookingId) {
          console.warn(
            "⚠ checkout.session.completed sin bookingId en metadata"
          );
        } else {
          await Booking.findByIdAndUpdate(bookingId, {
            status: "paid",
            stripePaymentIntentId: session.payment_intent || null,
          });
          console.log("✅ Reserva marcada como PAID:", bookingId);
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("❌ Error en webhook:", err);
      res.status(500).json({ received: false });
    }
  }
);

// ==================================
// 🟢 A partir de acá, JSON normal
// ==================================
app.use(express.json());

// =============================
// 🟢 Conexión MongoDB
// =============================
console.log("DEBUG MONGO_URI:", mongoUri ? "SET" : "MISSING");

mongoose
  .connect(mongoUri)
  .then(() => console.log("✅ MongoDB OK"))
  .catch((err) => {
    console.error("❌ MongoDB error", err);
  });

// =============================
// 🟢 Guías (mock)
// =============================
const guides = [
  {
    id: "g1001",
    name: "Arun - Bangkok Local Guide",
    city: "Bangkok",
    country: "Tailandia",
    hourlyRate: 18,
    dailyRate: 110,
    rating: 4.8,
  },
  {
    id: "g1002",
    name: "Maya - Kathmandu Cultural Guide",
    city: "Kathmandu",
    country: "Nepal",
    hourlyRate: 15,
    dailyRate: 95,
    rating: 5.0,
  },
  {
    id: "g1003",
    name: "Sofia - Experta en Buenos Aires",
    city: "Buenos Aires",
    country: "Argentina",
    hourlyRate: 20,
    dailyRate: 120,
    rating: 4.9,
  },
];

// =============================
// 🟢 Modelo BOOKING
// =============================
const bookingSchema = new mongoose.Schema(
  {
    guideId: String,
    guideName: String,
    travelerEmail: String,
    travelerName: String,
    date: String,
    hours: Number,
    amountUsd: Number,
    currency: { type: String, default: "USD" },
    stripeSessionId: String,
    stripePaymentIntentId: String,
    status: { type: String, default: "pending" },
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);

// =============================
// 🟢 Health
// =============================
app.get("/api/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1;
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    port: process.env.PORT || 4026,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || null,
    cors: allowedOrigins,
    db: dbStatus,
    stripeKeyLoaded: !!stripeSecretKey,
  });
});

// =============================
// 🟢 Listar guías
// =============================
app.get("/api/guides", (req, res) => {
  res.json(guides);
});

// =============================
// 🟢 Crear checkout + reserva pending
// =============================
app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    const { guideId, date, hours, amountUsd, customerEmail } = req.body;

    if (!guideId || !date || !hours || !amountUsd || !customerEmail) {
      return res.status(400).json({ ok: false, error: "Faltan datos" });
    }

    const guide = guides.find((g) => g.id === guideId);
    const guideName = guide ? guide.name : "Unknown Guide";

    // 1) Crear reserva en estado pending
    const booking = await Booking.create({
      guideId,
      guideName,
      travelerEmail: customerEmail,
      date,
      hours,
      amountUsd,
      status: "pending",
    });

    // 2) Crear sesión de pago en Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      success_url: "https://success.iguideu.com",
      cancel_url: "https://cancel.iguideu.com",
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountUsd * 100,
            product_data: {
              name: `Reserva con ${guideName}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingId: booking._id.toString(),
      },
    });

    booking.stripeSessionId = session.id;
    await booking.save();

    res.json({
      ok: true,
      checkoutUrl: session.url,
      bookingId: booking._id,
    });
  } catch (err) {
    console.error("❌ Error en create-checkout:", err);
    res.status(500).json({ ok: false, error: "Error interno" });
  }
});

// =============================
// 🟢 ADMIN – Listar reservas
// =============================
app.get("/api/admin/bookings", async (req, res) => {
  const key = req.headers["x-admin-key"];

  if (!key || key !== adminApiKey) {
    return res.status(401).json({ ok: false, error: "No autorizado" });
  }

  const { status, email } = req.query;
  const query = {};

  if (status) query.status = status;
  if (email) query.travelerEmail = email;

  const bookings = await Booking.find(query).sort({ createdAt: -1 });

  res.json({
    ok: true,
    total: bookings.length,
    bookings,
  });
});

// =============================
// 🟢 Iniciar servidor
// =============================
const PORT = process.env.PORT || 4026;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 iguideu-backend en http://0.0.0.0:${PORT}`);
});

