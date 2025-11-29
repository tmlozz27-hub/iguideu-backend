// ===============================
// I GUIDE U - Backend 24 (server.js)
// ===============================

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import Booking from './models/Booking.js';
import Guide from './models/Guide.js';  // si no existe, no rompe

dotenv.config();

const app = express();

// -----------------------------------------
// STRIPE
// -----------------------------------------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// -----------------------------------------
// CORS WHITELIST
// -----------------------------------------
const allowedOrigins = [
  "http://127.0.0.1:5181",
  "http://localhost:5181",
  "http://192.168.0.4:5181"
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: "GET,POST",
    allowedHeaders: ["Content-Type", "x-admin-key"],
  })
);

// -----------------------------------------
// WEBHOOK Stripe (usa RAW BODY)
// ⚠️ DEBE IR ANTES DE express.json()
// -----------------------------------------
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;

          const amountTotal = session.amount_total || 0;
          const currency = session.currency || "usd";

          const platformFee = Math.round(amountTotal * 0.10);
          const guideNet = amountTotal - platformFee;

          const metadata = session.metadata || {};

          await Booking.findOneAndUpdate(
            { stripeSessionId: session.id },
            {
              userEmail:
                session.customer_details?.email ||
                metadata.travelerEmail ||
                "unknown@iguideu.app",

              guideId: metadata.guideId || null,
              guideName: metadata.guideName || null,

              amountTotal,
              currency,
              platformFee,
              guideNet,

              stripeSessionId: session.id,
              stripePaymentIntentId:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent?.id || null,

              status: "paid",
            },
            { upsert: true, new: true }
          );

          console.log(`✅ Booking guardado para session ${session.id}`);
          break;
        }

        default:
          break;
      }

      res.json({ received: true });
    } catch (e) {
      console.error("❌ Error procesando webhook:", e);
      res.status(500).send("Webhook handler failed");
    }
  }
);

// -----------------------------------------
// JSON parser (DEBE IR DESPUÉS DEL WEBHOOK)
// -----------------------------------------
app.use(express.json());

// -----------------------------------------
// MongoDB
// -----------------------------------------
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch((err) => console.error("❌ Error MongoDB:", err));

// -----------------------------------------
// ENDPOINTS
// -----------------------------------------

// Health
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    port: process.env.PORT || 4026,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "not-set",
    cors: allowedOrigins,
    db: mongoose.connection.readyState === 1,
    stripeKeyLoaded: process.env.STRIPE_SECRET_KEY ? true : false
  });
});

// Guías
app.get('/api/guides', async (req, res) => {
  try {
    const guides = await Guide.find().lean();
    res.json({ value: guides, Count: guides.length });
  } catch (err) {
    console.error("❌ Error en /api/guides", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Crear Checkout Stripe
app.post('/api/checkout', async (req, res) => {
  try {
    const { amount, currency, guideId, guideName, travelerEmail } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      success_url: `${process.env.PUBLIC_BASE_URL}/success`,
      cancel_url: `${process.env.PUBLIC_BASE_URL}/cancel`,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: guideName || "Local Guide" },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        guideId: guideId || "",
        guideName: guideName || "",
        travelerEmail: travelerEmail || "",
      },
    });

    console.log("🧾 Checkout creado:", session.id);

    res.json({
      ok: true,
      url: session.url,
      sessionId: session.id
    });
  } catch (err) {
    console.error("❌ Error creando checkout:", err);
    res.status(500).json({ error: "Error creating checkout" });
  }
});

// -----------------------------------------
// Start Server
// -----------------------------------------
const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend 24 en http://0.0.0.0:${PORT}`);
});
