// =======================================================
// =============== BACKEND I GUIDE U – v24 ===============
// =======================================================

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Stripe from "stripe";
import bodyParser from "body-parser";

// =============================================
// =============== ENVIRONMENT =================
// =============================================
import dotenv from "dotenv";
dotenv.config();

const app = express();

// Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
console.log(`🔑 STRIPE_SECRET_KEY preview: ${STRIPE_SECRET_KEY.slice(0, 10)}...(OK)`);

const stripe = new Stripe(STRIPE_SECRET_KEY);

// MongoDB
const MONGO_URI = process.env.MONGO_URI;
console.log("DEBUG MONGO_URI (hidden prefix):", MONGO_URI ? MONGO_URI.slice(0, 35) + "..." : "NOT SET");

const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "iguideu_local";

// Webhook RAW body parser (Stripe requirement)
app.use(
  "/api/stripe/webhook",
  bodyParser.raw({ type: "application/json" })
);

// JSON middleware
app.use(express.json());

// =============================================
// ================== CORS ======================
// =============================================
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

// =============================================
// ================ MONGOOSE ====================
// =============================================
mongoose
  .connect(MONGO_URI, {
    dbName: MONGODB_DB_NAME,
  })
  .then(() => console.log("✅ MongoDB conectado correctamente"))
  .catch((err) => console.error("❌ Error MongoDB:", err));

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
// =========== FUNCIONES DE PRECIO ==============
// =============================================
function calcularPrecio(guide, hours) {
  const priceHour = guide.priceHour;
  const priceDay = guide.priceDay;

  if (hours >= 1 && hours <= 7) {
    return {
      type: "HOURS",
      total: hours * priceHour,
    };
  }

  if (hours === 8) {
    return {
      type: "DAY",
      total: priceDay,
    };
  }

  if (hours >= 9 && hours <= 12) {
    const extraHours = hours - 8;
    const totalExtra = priceDay + extraHours * priceHour;

    return {
      type: hours === 12 ? "PROMO_12H" : "EXTRA",
      total: hours === 12 ? priceDay + 12 * priceHour : totalExtra,
    };
  }

  return {
    type: "FULL_DAY_24H",
    total: priceDay + 8 * priceHour,
  };
}

// =============================================
// ================ ENDPOINTS ===================
// =============================================

// HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    port: process.env.PORT || 4026,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "local",
    db: mongoose.connection.readyState === 1,
    stripeKeyLoaded: STRIPE_SECRET_KEY.startsWith("sk_"),
  });
});

// LISTA DE GUÍAS
app.get("/api/guides", async (req, res) => {
  const guides = await Guide.find();
  res.json(guides);
});

// CREAR CHECKOUT REAL
app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    const { guideId, hours, travelerName, travelerEmail } = req.body;

    const guide = await Guide.findOne({ id: guideId });
    if (!guide) {
      return res.status(400).json({ ok: false, error: "Guía no encontrado" });
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

// ADMIN – RESERVAS
app.get("/api/admin/bookings", async (req, res) => {
  const bookings = await Booking.find().sort({ createdAt: -1 });
  res.json(bookings);
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

// =======================================================
// ======================= START SERVER ==================
// =======================================================

const PORT = process.env.PORT || 4026;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend 24 corriendo en http://0.0.0.0:${PORT}`);
});
