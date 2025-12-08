// ================================================================
//  I GUIDE U – BACKEND 24  (Render + Frontend Simple)
//  SERVER.JS COMPLETO PARA PEGAR ENTERO
// ================================================================

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Stripe from "stripe";

// ---------------------------------------------------------------
// ENV
// ---------------------------------------------------------------
dotenv.config();

const PORT = process.env.PORT || 4026;
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || "https://iguideu-backend-1.onrender.com";

const MONGO_URI = process.env.MONGO_URI;
const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

// ---------------------------------------------------------------
// CORS CONFIG (Frontend local + dominio producción + Cloudflare)
// ---------------------------------------------------------------
const allowedOrigins = [
  "http://localhost:5181",
  "http://127.0.0.1:5181",
  "http://192.168.0.4:5181",
  "https://iguideu-backend-1.onrender.com",
  "https://api.i-guide-u.com",
  "https://www.api.i-guide-u.com",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // permite Postman / PowerShell
    if (allowedOrigins.includes(origin)) return callback(null, true);

    console.log("[CORS BLOCKED] Origin no permitido:", origin);
    return callback(new Error("CORS: Origin not allowed"));
  },
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

// ---------------------------------------------------------------
// MONGO
// ---------------------------------------------------------------
console.log("DEBUG MONGO_URI:", MONGO_URI);

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch((err) => console.error("❌ Error MongoDB:", err));

// ---------------------------------------------------------------
// MODELOS
// ---------------------------------------------------------------
const guideSchema = new mongoose.Schema({
  name: String,
  city: String,
  country: String,
  hourlyRate: Number,
  dailyRate: Number,
  rating: Number,
  languages: [String],
  description: String,
});

const bookingSchema = new mongoose.Schema(
  {
    guideName: String,
    city: String,
    country: String,
    duration: String,
    total: Number,
    email: String,
    paymentStatus: String, // pending | PAID | cancelled
    meta: { type: Object, default: {} },
    stripeCheckoutSessionId: String,
  },
  { timestamps: true }
);

const Guide =
  mongoose.models.Guide || mongoose.model("Guide", guideSchema);
const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

// ---------------------------------------------------------------
// RUTAS
// ---------------------------------------------------------------

// HEALTH CHECK
app.get("/api/health", async (req, res) => {
  try {
    return res.json({
      ok: true,
      env: process.env.NODE_ENV || "unknown",
      port: String(PORT),
      publicBaseUrl: PUBLIC_BASE_URL,
      db: !!mongoose.connection.readyState,
      stripeKeyLoaded: !!stripeSecret,
    });
  } catch (err) {
    console.error("ERROR /api/health:", err);
    res.status(500).json({ ok: false });
  }
});

// LISTAR GUÍAS
app.get("/api/guides", async (req, res) => {
  try {
    const guides = await Guide.find().lean();
    return res.json({ ok: true, guides });
  } catch (err) {
    console.error("ERROR /api/guides:", err);
    res.status(500).json({ ok: false, error: "Error leyendo guías" });
  }
});

// LISTAR RESERVAS (para frontend simple)
app.get("/api/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find().lean();
    return res.json({ ok: true, bookings });
  } catch (err) {
    console.error("ERROR /api/bookings:", err);
    res.status(500).json({ ok: false, error: "Error leyendo reservas" });
  }
});

// TEST CHECKOUT STRIPE
app.post("/api/payments/test-checkout", async (req, res) => {
  try {
    if (!stripe) {
      console.warn("[WARN] STRIPE_SECRET_KEY no seteado. URL dummy.");
      return res.json({
        ok: true,
        url: "https://checkout.stripe.com/pay/test_dummy_url",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url:
        process.env.SUCCESS_URL ||
        "https://iguideu-backend-1.onrender.com/success-demo",
      cancel_url:
        process.env.CANCEL_URL ||
        "https://iguideu-backend-1.onrender.com/cancel-demo",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Test pago Stripe (USD 10) – I GUIDE U" },
            unit_amount: 1000,
          },
          quantity: 1,
        },
      ],
    });

    return res.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    console.error("ERROR /api/payments/test-checkout:", err);
    res.status(500).json({ ok: false, error: "Error creando Checkout" });
  }
});

// ---------------------------------------------------------------
// SERVIDOR
// ---------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Backend 24 corriendo en http://0.0.0.0:${PORT}`);
});
