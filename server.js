// ======================================================
// I GUIDE U – Backend 24 – server.js (FINAL FASE 1)
// ======================================================

import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import Stripe from "stripe";
import bodyParser from "body-parser";

dotenv.config();

// ======================================================
// CONFIG
// ======================================================
const PORT = process.env.PORT || 4026;
const NODE_ENV = process.env.NODE_ENV || "development";

const DB_NAME =
  process.env.DB_NAME || process.env.MONGODB_DB_NAME || "iguideu20";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// ======================================================
// APP
// ======================================================
const app = express();
app.use(cors());

// ======================================================
// STRIPE WEBHOOK (RAW BODY – ANTES DE JSON)
// ======================================================
app.post(
  "/api/stripe/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      if (!stripe || !STRIPE_WEBHOOK_SECRET) {
        return res.status(200).send("ok");
      }

      const sig = req.headers["stripe-signature"];
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const bookingId = session?.metadata?.bookingId;
        const paymentStatus = session?.payment_status;

        if (bookingId && paymentStatus === "paid") {
          await Booking.findByIdAndUpdate(bookingId, {
            status: "PAID",
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: session.payment_intent || null,
            stripeCustomerEmail:
              session?.customer_details?.email || null,
          });
        }
      }

      return res.json({ received: true });
    } catch (err) {
      console.error("❌ Error webhook Stripe:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// ======================================================
// JSON NORMAL
// ======================================================
app.use(express.json());

// ======================================================
// MONGO
// ======================================================
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI no definido");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI, { dbName: DB_NAME })
  .then(() =>
    console.log(`✅ MongoDB conectado → DB: ${DB_NAME}`)
  )
  .catch((err) => console.error("❌ Mongo error:", err));

// ======================================================
// MODELOS
// ======================================================
const bookingSchema = new mongoose.Schema(
  {
    guideId: mongoose.Schema.Types.ObjectId,
    guideName: String,
    travelerEmail: String,
    durationType: String,
    hours: Number,
    totalAmountUsd: Number,
    status: { type: String, default: "PENDING" },

    stripeCheckoutSessionId: String,
    stripePaymentIntentId: String,
    stripeCustomerEmail: String,
  },
  { timestamps: true }
);

const Booking =
  mongoose.models.Booking ||
  mongoose.model("Booking", bookingSchema);

// ======================================================
// ROUTES
// ======================================================

// HEALTH
app.get("/api/health", (req, res) => {
  res.json({ ok: true, env: NODE_ENV });
});

// GUIDES – LISTAR
app.get("/api/guides", async (req, res) => {
  try {
    const guides = await mongoose.connection.db
      .collection("guides")
      .find({})
      .toArray();

    res.json({ ok: true, guides });
  } catch (err) {
    console.error("❌ /api/guides:", err);
    res.status(500).json({ ok: false });
  }
});

// BOOKINGS – CREAR
app.post("/api/bookings/create", async (req, res) => {
  try {
    const {
      guideId,
      guideName,
      travelerEmail,
      durationType,
      hours,
      totalAmountUsd,
    } = req.body;

    const booking = await Booking.create({
      guideId,
      guideName,
      travelerEmail,
      durationType,
      hours,
      totalAmountUsd,
      status: "PENDING",
    });

    res.json({ ok: true, booking });
  } catch (err) {
    console.error("❌ create booking:", err);
    res.status(500).json({ ok: false });
  }
});

// STRIPE CHECKOUT REAL
app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ ok: false });
    }

    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ ok: false });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: booking.travelerEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Reserva I GUIDE U – ${booking.guideName}`,
            },
            unit_amount: Math.round(
              booking.totalAmountUsd * 100
            ),
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingId: String(booking._id),
      },
      success_url:
        "https://iguideu.com/stripe-success",
      cancel_url:
        "https://iguideu.com/stripe-cancel",
    });

    booking.stripeCheckoutSessionId = session.id;
    await booking.save();

    res.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("❌ checkout:", err);
    res.status(500).json({ ok: false });
  }
});

// ADMIN – VER BOOKINGS
app.get("/api/admin/bookings", async (req, res) => {
  try {
    const { email } = req.query;
    const filter = email ? { travelerEmail: email } : {};
    const bookings = await Booking.find(filter).lean();

    if (!bookings.length) {
      return res.json({ ok: false, bookings: [] });
    }

    res.json({ ok: true, bookings });
  } catch (err) {
    console.error("❌ admin bookings:", err);
    res.status(500).json({ ok: false });
  }
});

// ======================================================
// START
// ======================================================
app.listen(PORT, () => {
  console.log(
    `🚀 Backend 24 corriendo en 0.0.0.0:${PORT}`
  );
});
