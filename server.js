import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import Stripe from "stripe";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  cors({
    origin: [
      "http://127.0.0.1:5181",
      "http://localhost:5181",
      "http://127.0.0.1:5173",
      "http://localhost:5173",
    ],
  })
);

app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

console.log("DEBUG MONGO_URI:", process.env.MONGO_URI);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB OK"))
  .catch((err) => console.error("❌ MongoDB ERROR:", err.message));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV,
    port: process.env.PORT,
    publicBaseUrl: process.env.PUBLIC_BASE_URL,
    db: mongoose.connection.readyState === 1,
    stripeKeyLoaded: !!process.env.STRIPE_SECRET_KEY,
  });
});

app.get("/api/guides", (req, res) => {
  const guides = [
    {
      code: "g1001",
      name: "Arun – Bangkok Local Guide",
      city: "Bangkok",
      country: "Tailandia",
      hourlyRate: 18,
      dailyRate: 110,
      rating: 4.8,
      languages: ["English", "Thai"],
      description: "Templos, street food y mercados nocturnos en Bangkok.",
      tags: ["temples", "street food", "night markets"],
    },
    {
      code: "g1002",
      name: "Maya – Kathmandu Cultural Guide",
      city: "Kathmandu",
      country: "Nepal",
      hourlyRate: 15,
      dailyRate: 95,
      rating: 5.0,
      languages: ["English", "Nepali"],
      description: "Cultura del valle de Katmandú, templos y vida local.",
      tags: ["culture", "temples", "local life"],
    },
    {
      code: "g1003",
      name: "Sofia – Experta en Buenos Aires",
      city: "Buenos Aires",
      country: "Argentina",
      hourlyRate: 20,
      dailyRate: 120,
      rating: 4.9,
      languages: ["Spanish", "English"],
      description: "Historia, cafés notables y barrios clásicos porteños.",
      tags: ["history", "local life", "culture"],
    },
  ];

  res.json({ ok: true, guides });
});

app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    const { guideId, userEmail, amountUSD, amount } = req.body;

    let amountNumber = Number(amountUSD);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      amountNumber = Number(amount);
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ ok: false, error: "Monto inválido" });
    }

    const unitAmount = Math.round(amountNumber * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      success_url: `${process.env.PUBLIC_BASE_URL}/success.html`,
      cancel_url: `${process.env.PUBLIC_BASE_URL}/cancel.html`,
      customer_email: userEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            product_data: {
              name: `Reserva con guía ${guideId || "test"}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        guideId: guideId || "test",
        userEmail: userEmail || "test@example.com",
        amountUSD: amountNumber,
      },
    });

    res.json({ ok: true, url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("❌ Error create-checkout:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log("⚡ Evento recibido:", event.type);

    if (event.type === "checkout.session.completed") {
      console.log("💰 Pago COMPLETADO");
    }

    res.json({ received: true });
  }
);

if (process.env.NODE_ENV !== "production") {
  app.use(express.static(path.join(__dirname, "public")));
}

const PORT = process.env.PORT || 4026;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 iguideu23 backend en http://0.0.0.0:${PORT}`);
});