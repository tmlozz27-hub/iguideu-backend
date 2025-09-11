import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Sirve /public (mini front)
app.use(express.static(path.join(__dirname, "public")));

// Rutas opcionales (no rompen si no existen)
try {
  const paymentsRoutes = (await import("./src/routes/payments.routes.js")).default;
  if (paymentsRoutes) app.use("/api/payments", paymentsRoutes);
} catch {}

try {
  const bookingRoutes = (await import("./src/routes/booking.routes.js")).default;
  if (bookingRoutes) app.use("/api/bookings", bookingRoutes);
} catch {}

// Health
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV || "development",
    dbState: mongoose.connection.readyState,
    timestamp: new Date().toISOString(),
  });
});

// Landings simples
app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "iguideu-backend",
    hint: "try /api/health or /payments-test.html",
  });
});

app.get("/payments-test.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "payments-test.html"));
});

// Mongo
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/iguideu";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("[OK] MongoDB conectado"))
  .catch((err) => console.error("[ERR] MongoDB", err.message));

// Listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[OK] Servidor Express en 0.0.0.0:${PORT}`);
});
