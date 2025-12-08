import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Routers
import guidesRouter from "./routes/guides.js";
import bookingsRouter from "./routes/bookings.js";
import paymentsRouter from "./routes/payments.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ------------ CONFIG BASICA ------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// ------------ VARIABLES ---------------------
const PORT = process.env.PORT || 10000;

// MONGO DEFINITIVO (IGUIDEU20)
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://iguideu20_user:Lore4141@iguideu-db.sfgtfz8.mongodb.net/iguideu20?retryWrites=true&w=majority&appName=iguideu-db";

console.log("DEBUG MONGO_URI:", MONGO_URI);

// ------------ CONEXIÓN MONGO -----------------
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado correctamente"))
  .catch((err) => console.error("❌ Error MongoDB:", err));

// ------------ RUTAS --------------------------
app.get("/api/health", async (req, res) => {
  return res.json({
    ok: true,
    env: process.env.NODE_ENV || "production",
    port: PORT,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "https://iguideu-backend-1.onrender.com",
    db: mongoose.connection.readyState === 1,
    stripeKeyLoaded: !!process.env.STRIPE_SECRET_KEY,
  });
});

app.use("/api/guides", guidesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/payments", paymentsRouter);

// ------------ SERVIDOR ------------------------
app.listen(PORT, () => {
  console.log(`🚀 Backend 24 corriendo en http://0.0.0.0:${PORT}`);
});
