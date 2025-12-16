import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

// RUTAS
import guidesRouter from "./routes/guides.js";
import bookingsRouter from "./routes/bookings.js";
import adminRouter from "./routes/admin.js";
import paymentsRouter from "./routes/payments.js";

dotenv.config();

const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());

// ===== HEALTH =====
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    port: process.env.PORT,
    db: mongoose.connection.readyState === 1,
    stripeKeyLoaded: !!process.env.STRIPE_SECRET_KEY,
  });
});

// ===== ROUTES =====
app.use("/api/guides", guidesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/payments", paymentsRouter);

// ===== START SERVER =====
const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI no definida en .env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    dbName: process.env.DB_NAME || undefined,
  })
  .then(() => {
    console.log("✅ Mongo conectado:", mongoose.connection.name);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ I GUIDE U backend running on port ${PORT} (LAN only, 0.0.0.0)`);
    });
  })
  .catch((err) => {
    console.error("❌ Error conectando a Mongo:", err.message);
    process.exit(1);
  });
