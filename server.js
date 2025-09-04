import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import morgan from "morgan";
import { errors as celebrateErrors } from "celebrate";
import { applySecurity } from "./src/config/security.js";
import authRoutes from "./src/routes/auth.routes.js";
import bookingRoutes from "./src/routes/booking.routes.js";
import policyRoutes from "./src/routes/policy.routes.js";

const app = express();
app.set("trust proxy", 1);
applySecurity(app);
app.use(express.json({ limit: "512kb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState; // 0=down,1=connected,2=connecting,3=disconnecting
  res.json({ status: "ok", env: process.env.NODE_ENV, dbState, timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/policy", policyRoutes);

app.use(celebrateErrors());
app.use((err, req, res, next) => {
  console.error(err);
  const code = err.status || 500;
  res.status(code).json({ error: code === 500 ? "Internal error" : err.message || "Error" });
});

const PORT = process.env.PORT || 3000;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .then(() => app.listen(PORT, () => console.log(`🚀 Servidor Express en 127.0.0.1:${PORT}`)))
  .catch((e) => {
    console.error("❌ Mongo error:", e.message);
    process.exit(1);
  });
