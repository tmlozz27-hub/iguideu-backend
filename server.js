import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import guidesRouter from "./routes/guides.js";
import bookingsRouter from "./routes/bookings.js";
import paymentsRouter from "./routes/payments.js";
import stripeWebhookRouter from "./routes/stripeWebhook.js";
import paymentReturnPagesRouter from "./routes/paymentReturnPages.js";

dotenv.config();

const app = express();

/* =========================
   RAW BODY para Stripe
========================= */
app.use(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" })
);

/* =========================
   JSON normal (todo lo demás)
========================= */
app.use(express.json());

/* =========================
   CORS
========================= */
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : ["*"];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

/* =========================
   HEALTH
========================= */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "production",
    dbName: process.env.MONGODB_DB_NAME,
  });
});

/* =========================
   ROUTES API
========================= */
app.use("/api/guides", guidesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/payments", paymentsRouter);

/* =========================
   STRIPE
========================= */
app.use("/api/stripe", stripeWebhookRouter);

/* =========================
   RETURN PAGES (Stripe)
========================= */
app.use("/", paymentReturnPagesRouter);

/* =========================
   DB + SERVER START
========================= */
const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ Mongo conectado:", process.env.MONGODB_DB_NAME);
    app.listen(PORT, () => {
      console.log(`🚀 Backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Mongo error:", err);
    process.exit(1);
  });
