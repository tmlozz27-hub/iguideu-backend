import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import Stripe from "stripe";
import bodyParser from "body-parser";

dotenv.config();

const PORT = process.env.PORT || 4026;
const DB_NAME = process.env.DB_NAME || "iguideu20";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const app = express();
app.use(cors());

// ✅ WEBHOOK RAW: ANTES de express.json()
app.post(
  "/api/stripe/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(200).send("ok");

      const sig = req.headers["stripe-signature"];
      const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const bookingId = session?.metadata?.bookingId;
        const paymentStatus = session?.payment_status;

        if (bookingId && paymentStatus === "paid") {
          await Booking.findByIdAndUpdate(bookingId, { status: "PAID" });
        }
      }

      return res.json({ received: true });
    } catch (err) {
      console.error("❌ Error webhook Stripe:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// JSON normal para todo lo demás
app.use(express.json());

if (!process.env.MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI NO DEFINIDO.");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI, { dbName: DB_NAME })
  .then(() => console.log(`✅ MongoDB conectado → DB: ${DB_NAME}`))
  .catch((err) => console.error("❌ Error MongoDB:", err));

const bookingSchema = new mongoose.Schema(
  {
    travelerEmail: String,
    totalAmountUsd: Number,
    status: { type: String, default: "PENDING" },
  },
  { timestamps: true }
);

const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`🚀 Backend corriendo en :${PORT}`));
