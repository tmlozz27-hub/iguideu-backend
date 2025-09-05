import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import hpp from "hpp";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

import authRoutes from "./src/routes/auth.routes.js";
import bookingRoutes from "./src/routes/booking.routes.js";
import policyRoutes from "./src/routes/policy.routes.js";
import { dbReady } from "./src/middlewares/dbReady.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(hpp());
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 200),
});
app.use(limiter);

app.get("/api/health", (req, res) => {
  const dbState =
    global.mongoose && global.mongoose.connection
      ? global.mongoose.connection.readyState
      : 0;
  res.json({
    status: "ok",
    env: process.env.NODE_ENV || "development",
    dbState,
    timestamp: new Date().toISOString(),
  });
});

const MONGO_URI = process.env.MONGO_URI;
const PORT = Number(process.env.PORT || 3000);

async function connectDB() {
  if (!MONGO_URI) {
    console.warn("[WARN] MONGO_URI no configurada. Arranco sin DB para health.");
    return;
  }
  try {
    await mongoose.connect(MONGO_URI);
    global.mongoose = mongoose;

    if (!global.models) {
      const { default: User } = await import("./src/models/User.js");
      const { default: Booking } = await import("./src/models/Booking.js");
      global.models = { User, Booking };
    }

    console.log("[OK] MongoDB conectado");
  } catch (err) {
    console.error("[ERR] Mongo error:", err.message);
  }
}

app.use("/api/auth", dbReady, authRoutes);
app.use("/api/bookings", dbReady, bookingRoutes);
app.use("/api/policy", policyRoutes);

app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "internal error" });
});

async function start() {
  await connectDB();
  app.listen(PORT, "127.0.0.1", () => {
    console.log("[OK] Servidor Express en 127.0.0.1:" + PORT);
  });
}
start();
