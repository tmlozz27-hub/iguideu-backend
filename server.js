import express from "express";
import { applyHardening } from "./src/middlewares/hardening.mjs";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import mongoose from "mongoose";

import authRoutes from "./src/routes/auth.routes.js";
import guidesRoutes from "./src/routes/guides.routes.js";
import bookingsRoutes from "./src/routes/bookings.routes.js";
import paymentsRoutes from "./src/routes/payments.routes.js";

dotenv.config();
export const app = express();
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Conexión Mongo
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("[OK] MongoDB conectado"))
  .catch((err) => console.error("[ERR] MongoDB Error:", err));

// Health
app.get("/api/health", (req, res) => {
  return res.json({
    status: "ok",
    env: process.env.NODE_ENV || "development",
    dbState: mongoose.connection.readyState,
    timestamp: new Date().toISOString(),
  });
});

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/guides", guidesRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/payments", paymentsRoutes);

// 404
app.use((req, res) =>
  res.status(404).json({ error: "not_found", path: req.originalUrl })
);

// Listen
app.listen(PORT, "0.0.0.0", () =>
  console.log(`[OK] Servidor Express en 0.0.0.0:${PORT}`)
);





