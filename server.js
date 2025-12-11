// =======================================================
// =============== BACKEND I GUIDE U – v24 ===============
// =======================================================

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Stripe from "stripe";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// =============================================
// =============== STRIPE =======================
// =============================================
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
console.log(
  `🔑 STRIPE_SECRET_KEY preview: ${STRIPE_SECRET_KEY.slice(0, 10)}...(OK)`
);
const stripe = new Stripe(STRIPE_SECRET_KEY);

// =============================================
// =============== MONGO ========================
// =============================================
const MONGO_URI = process.env.MONGO_URI;
console.log(
  "DEBUG MONGO_URI prefix:",
  MONGO_URI ? MONGO_URI.slice(0, 35) + "..." : "NOT SET"
);

// usamos la misma DB que el seed
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "iguideu20";
console.log("DEBUG DB_NAME:", MONGODB_DB_NAME);

// =============================================
// =============== MIDDLEWARE ===================
// =============================================

// Stripe Webhook RAW body
app.use(
  "/api/stripe/webhook",
  bodyParser.raw({ type: "application/json" })
);

// JSON para el resto
app.use(express.json());

// CORS
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

// =============================================
// ================ MODELOS =====================
// =============================================

const GuideSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    city: String,
    country: String,
    rating: Number,
    priceHour: Number,
    priceDay: Number,
    // por compatibilidad, por si algún día usamos hourlyRate/dailyRate
    hourlyRate: Number,
    dailyRate: Number,
  },
  { timestamps: true }
);

const Guide = mongoose.model("Guide", GuideSchema);

const BookingSchema = new mongoose.Schema(
  {
    guideId: String,
    guideName: String,
    travelerName: String,
    travelerEmail: String,
    hours: Number,
    durationType: {
      type: String,
      enum: ["HOURS", "DAY", "EXTRA", "PROMO_12H", "FULL_DAY_24H"],
    },
    total: Number,
    stripeCheckoutSessionId: String,
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    rawStripeSession: Object,
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", BookingSchema);

// =============================================
// ============ CONEXIÓN MONGODB ===============
// =============================================
mongoose
  .connect(MONGO_URI, { dbName: MONGODB_DB_NAME })
  .then(async () => {
    console.log(`✅ MongoDB conectado → DB: ${MONGODB_DB_NAME}`);
    const count = await Guide.countDocuments();
    console.log("🐾 DEBUG cantidad guides:", count);
  })
  .catch((err) => console.error("❌ Error MongoDB:", err));

// =============================================
// =========== FUNCIÓN DE PRECIOS ===============
// =============================================
function calcularPrecio(guide, hours) {
  const priceHour = guide.priceHour ?? guide.hourlyRate;
  const priceDay = guide.priceDay ?? guide.dailyRate;

  if (priceHour == null || priceDay == null) {
    throw new Error(
      "Guía sin tarifas (priceHour/priceDay o hourlyRate/dailyRate)"
    );
  }

  if (hours >= 1 && hours <= 7)
    return { type: "HOURS", total: hours * priceHour };

  if (hours === 8) return { type: "DAY", total: priceDay };

  if (hours >= 9 && hours <= 12) {
    const extraHours = hours - 8;
    const total = priceDay + extraHours * priceHour;

    return {
      type: hours === 12 ? "PROMO_12H" : "EXTRA",
      total,
    };
  }

  return { type: "FULL_DAY_24H", total: priceDay + 8 * priceHour };
}

// =============================================
// ================ ENDPOINTS ===================
// =============================================

// HEALTH
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    port: process.env.PORT,
    publicBaseUrl: process.env.PUBLIC_BASE_URL,
    db: mongoose.connection.readyState === 1,
    stripeKeyLoaded: STRIPE_SECRET_KEY.startsWith("sk_"),
  });
});

// LISTA DE GUÍAS
app.get("/api/guides", async (req, res) => {
  const guides = await Guide.find();
  res.json(guides);
});

// RESERVAS ADMIN
app.get("/api/admin/bookings", async (req, res) => {
  const bookings = await Booking.find().sort({ createdAt: -1 });
  res.json(bookings);
});

// CHECKOUT REAL + TEST (mismo endpoint)
app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    const {
      guideId,
      hours,
      travelerName,
      travelerEmail,
      testMode,
    } = req.body;

    console.log("💳 create-checkout payload:", {
      guideId,
      hours,
      travelerName,
      travelerEmail,
      testMode,
    });

    // -----------------------------------------
    // MODO TEST (botón "Test pago Stripe USD 10")
    // -----------------------------------------
    // Si NO viene guideId u hours => asumimos que es el TEST de frontend
    if (!guideId || !hours) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: travelerEmail || "test+frontend@iguideu.com",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Test pago Stripe (USD 10) – I GUIDE U",
              },
              unit_amount: 10 * 100,
            },
            quantity: 1,
          },
        ],
        success_url: `${process.env.PUBLIC_BASE_URL}/success`,
        cancel_url: `${process.env.PUBLIC_BASE_URL}/cancel`,
      });

      console.log("✅ Checkout TEST creado:", session.id);

      return res.json({
        ok: true,
        mode: "test",
        amountUsd: 10,
        stripeCheckoutSessionId: session.id,
        url: session.url,
      });
    }

    // -----------------------------------------
    // MODO REAL (botón "Crear Checkout real y abrir Stripe")
    // -----------------------------------------

    // Buscamos primero por _id (frontend usa _id)
    let guide = null;
    if (mongoose.Types.ObjectId.isValid(guideId)) {
      guide = await Guide.findById(guideId);
    }

    // fallback por id lógico, por las dudas
    if (!guide) {
      guide = await Guide.findOne({ id: guideId });
    }

    if (!guide) {
      console.log("❌ Guía no encontrado para guideId:", guideId);
      return res
        .status(400)
        .json({ ok: false, error: "Guía no encontrado" });
    }

    const price = calcularPrecio(guide, hours);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: travelerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${guide.name} – ${hours}h (${price.type})`,
            },
            unit_amount: Math.round(price.total * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.PUBLIC_BASE_URL}/success`,
      cancel_url: `${process.env.PUBLIC_BASE_URL}/cancel`,
    });

    const booking = await Booking.create({
      guideId,
      guideName: guide.name,
      travelerName,
      travelerEmail,
      hours,
      durationType: price.type,
      total: price.total,
      stripeCheckoutSessionId: session.id,
      rawStripeSession: session,
    });

    console.log("✅ Checkout REAL creado:", session.id);

    return res.json({
      ok: true,
      mode: "booking",
      bookingId: booking._id,
      amountUsd: price.total,
      durationType: price.type,
      stripeCheckoutSessionId: session.id,
      url: session.url,
    });
  } catch (err) {
    console.error("❌ Error create-checkout:", err);
    res.status(500).json({ ok: false, error: "Error creando checkout" });
  }
});

// =============================================
// =============== STRIPE WEBHOOK ==============
// =============================================
app.post("/api/stripe/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("❌ Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    await Booking.updateOne(
      { stripeCheckoutSessionId: session.id },
      { paymentStatus: "paid" }
    );
    console.log("💳 Pago confirmado:", session.id);
  }

  res.json({ received: true });
});

// =============================================
// ==== PÁGINAS PARA SUCCESS Y CANCEL STRIPE ====
// =============================================
app.get("/success", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
      <head><meta charset="UTF-8"><title>Pago exitoso – I GUIDE U</title></head>
      <body style="font-family: system-ui; text-align:center; padding:40px;">
        <h1>✅ Pago exitoso</h1>
        <p>Gracias por usar I GUIDE U.</p>
      </body>
    </html>
  `);
});

app.get("/cancel", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
      <head><meta charset="UTF-8"><title>Pago cancelado – I GUIDE U</title></head>
      <body style="font-family: system-ui; text-align:center; padding:40px;">
        <h1>⚠️ Pago cancelado</h1>
        <p>Puedes volver e intentar nuevamente.</p>
      </body>
    </html>
  `);
});

// =============================================
// ================ START SERVER ================
// =============================================
const PORT = process.env.PORT || 4026;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend 24 corriendo en http://0.0.0.0:${PORT}`);
});
