import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import Stripe from "stripe";

import paymentReturnPages from "./routes/paymentReturnPages.js";

dotenv.config();

const app = express();

// ====== Config ======
const PORT = process.env.PORT || 10000;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://iguideu-backend-1.onrender.com";

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || process.env.MONGO_DB || "iguideu20";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

// CORS (simple y seguro para ahora)
const corsOrigins = (process.env.CORS_ORIGINS || process.env.CORS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  })
);

// IMPORTANTE: webhook necesita raw body, por eso lo declaramos ANTES del json global
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      if (!STRIPE_SECRET_KEY) {
        return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY missing" });
      }
      if (!STRIPE_WEBHOOK_SECRET) {
        return res.status(500).json({ ok: false, error: "STRIPE_WEBHOOK_SECRET missing" });
      }

      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-09-30.clover" });

      const sig = req.headers["stripe-signature"];
      let event;

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.log("❌ Webhook signature failed:", err?.message || err);
        return res.status(400).send(`Webhook Error: ${err?.message || err}`);
      }

      // Solo nos interesa checkout.session.completed
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const bookingId = session?.metadata?.bookingId;

        if (bookingId && db) {
          await bookings().updateOne(
            { _id: new ObjectId(String(bookingId)) },
            { $set: { paymentStatus: "paid", stripeCheckoutSessionId: session.id, updatedAt: new Date() } }
          );
          console.log("✅ Booking marked PAID:", bookingId);
        } else {
          console.log("⚠️ Webhook received but no bookingId metadata");
        }
      }

      res.json({ received: true });
    } catch (e) {
      console.log("❌ Webhook error:", e?.message || e);
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  }
);

// JSON global para el resto
app.use(express.json({ limit: "1mb" }));

// Return pages (HTTPS) para volver a la app
app.use("/", paymentReturnPages);

// ====== Mongo ======
let client = null;
let db = null;

async function initMongo() {
  if (!MONGO_URI) {
    console.log("⚠️ MONGO_URI missing (db=false)");
    return;
  }
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log("✅ Mongo conectado:", DB_NAME);
  } catch (e) {
    console.log("❌ Error MongoDB:", e?.message || e);
    db = null;
  }
}

function guides() {
  return db.collection("guides");
}
function bookings() {
  return db.collection("bookings");
}

// ====== Routes ======

// Health
app.get("/api/health", async (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "production",
    port: String(PORT),
    publicBaseUrl: PUBLIC_BASE_URL,
    db: !!db,
    dbName: db ? DB_NAME : null,
    stripeKeyLoaded: !!STRIPE_SECRET_KEY,
  });
});

// Guides
app.get("/api/guides", async (req, res) => {
  try {
    if (!db) return res.status(500).json({ ok: false, error: "DB not connected" });
    const list = await guides().find({}).sort({ createdAt: -1 }).toArray();
    res.json({ ok: true, guides: list });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Bookings (create)
app.post("/api/bookings", async (req, res) => {
  try {
    if (!db) return res.status(500).json({ ok: false, error: "DB not connected" });

    const { guideId, guideName, travelerEmail, hoursRequested, totalUsd } = req.body || {};

    if (!guideId || !guideName || !travelerEmail || !hoursRequested || !totalUsd) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const hrs = Number(hoursRequested);
    const total = Number(totalUsd);

    let durationType = "HOURS";
    if (hrs === 24) durationType = "FULL_DAY_24H";
    else if (hrs >= 8) durationType = "DAY";

    const doc = {
      guideId: String(guideId),
      guideName: String(guideName),
      travelerEmail: String(travelerEmail),
      hoursRequested: hrs,
      durationType,
      totalUsd: total,
      paymentStatus: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const r = await bookings().insertOne(doc);

    res.json({ ok: true, bookingId: String(r.insertedId), booking: { ...doc, _id: r.insertedId } });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Stripe checkout
app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY missing" });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-09-30.clover" });

    const { bookingId, totalUsd } = req.body || {};
    if (!bookingId || !totalUsd) {
      return res.status(400).json({ ok: false, error: "Missing bookingId/totalUsd" });
    }

    const amount = Math.round(Number(totalUsd) * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid totalUsd" });
    }

    // IMPORTANT: return pages HTTPS -> ahí tocás "Volver a la app"
    const successUrl = `${PUBLIC_BASE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&bookingId=${encodeURIComponent(
      String(bookingId)
    )}`;
    const cancelUrl = `${PUBLIC_BASE_URL}/payment/cancel?bookingId=${encodeURIComponent(String(bookingId))}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: "I GUIDE U - Booking",
              description: `Booking ${bookingId}`,
            },
          },
        },
      ],
      metadata: { bookingId: String(bookingId) },
    });

    res.json({ ok: true, url: session.url, sessionId: session.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ====== Start ======
app.listen(PORT, async () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  await initMongo();
});
