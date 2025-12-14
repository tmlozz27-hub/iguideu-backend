import express from "express";
import cors from "cors";
import mongoose from "mongoose";

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* =========================
   MONGO
========================= */
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "iguideu20";

if (!MONGO_URI) {
  console.error("❌ MONGO_URI missing in env");
}

mongoose
  .connect(MONGO_URI, { dbName: DB_NAME })
  .then(() => console.log("✅ Mongo conectado:", DB_NAME))
  .catch((e) => console.error("❌ Mongo error:", e));

/* =========================
   MODELS
========================= */
const GuideSchema = new mongoose.Schema(
  {
    name: String,
    city: String,
    country: String,
    hourlyRateUsd: Number,
    dayRateUsd: Number,
    fullDay24hRateUsd: Number,
    languages: [String],
    rating: Number,
    bio: String,
    imageUrl: String,
  },
  { timestamps: true, collection: "guides" } // 👈 importante: usa la colección existente
);

const Guide = mongoose.models.Guide || mongoose.model("Guide", GuideSchema);

const BookingSchema = new mongoose.Schema(
  {
    guideId: { type: mongoose.Schema.Types.ObjectId, required: true },
    guideName: { type: String, required: true },
    travelerEmail: { type: String, required: true },

    hoursRequested: { type: Number, required: true },
    durationType: {
      type: String,
      enum: ["HOURS", "DAY_8H", "FULL_DAY_24H"],
      required: true,
    },

    totalUsd: { type: Number, required: true },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
  },
  { timestamps: true, collection: "bookings" }
);

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", BookingSchema);

/* =========================
   HELPERS
========================= */
function inferDurationType(hours) {
  if (hours === 24) return "FULL_DAY_24H";
  if (hours >= 8) return "DAY_8H";
  return "HOURS";
}

/* =========================
   ROUTES
========================= */
app.get("/api/health", async (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || "production", dbName: DB_NAME });
});

// ✅ RESTORE: GET /api/guides
app.get("/api/guides", async (req, res) => {
  try {
    const guides = await Guide.find({}).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ ok: true, guides });
  } catch (e) {
    console.error("❌ GET /api/guides", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ✅ PHASE 4: POST /api/bookings
app.post("/api/bookings", async (req, res) => {
  try {
    const { guideId, guideName, travelerEmail, hoursRequested, totalUsd } =
      req.body || {};

    if (!guideId || !guideName || !hoursRequested || totalUsd === undefined) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const hours = Number(hoursRequested);
    const total = Number(totalUsd);

    if (!Number.isFinite(hours) || hours <= 0)
      return res.status(400).json({ ok: false, error: "Invalid hours" });

    if (!Number.isFinite(total) || total < 0)
      return res.status(400).json({ ok: false, error: "Invalid total" });

    const booking = await Booking.create({
      guideId,
      guideName,
      travelerEmail: travelerEmail || "test+frontend@iguideu.com",
      hoursRequested: hours,
      durationType: inferDurationType(hours),
      totalUsd: total,
      paymentStatus: "pending",
    });

    return res.json({
      ok: true,
      bookingId: booking._id.toString(),
      booking,
    });
  } catch (e) {
    console.error("❌ POST /api/bookings", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

// Crear checkout
app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    const { bookingId, totalUsd } = req.body || {};
    if (!bookingId || totalUsd === undefined) {
      return res.status(400).json({ ok: false, error: "Missing bookingId/totalUsd" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_KEY missing" });
    }

    const amount = Math.round(Number(totalUsd) * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid amount" });
    }

    const successUrl = "iguideu://payment/success?session_id={CHECKOUT_SESSION_ID}";
    const cancelUrl = "iguideu://payment/cancel";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
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
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return res.json({ ok: true, url: session.url, sessionId: session.id });
  } catch (e) {
    console.error("❌ create-checkout", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// WEBHOOK (Stripe debe enviar raw body)
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const sig = req.headers["stripe-signature"];
      const whsec = process.env.STRIPE_WEBHOOK_SECRET;

      if (!whsec) {
        return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");
      }

      const event = stripe.webhooks.constructEvent(req.body, sig, whsec);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const bookingId = session?.metadata?.bookingId;

        if (bookingId) {
          await Booking.findByIdAndUpdate(bookingId, { paymentStatus: "paid" });
          console.log("✅ Booking marked PAID:", bookingId);
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("❌ webhook error", err);
      res.status(400).send(`Webhook Error`);
    }
  }
);

/* =========================
   START
========================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Backend running on port", PORT);
});
