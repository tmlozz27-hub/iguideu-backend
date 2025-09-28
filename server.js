import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Routers existentes
import authRouter from "./src/routes/auth.routes.js";
import bookingsRouter from "./src/routes/bookings.routes.js";
import adminRouter from "./src/routes/admin.routes.js";
import guidesRouter from "./src/routes/guides.routes.js";

// NUEVOS
import ordersRouter from "./src/routes/orders.routes.js";
import webhooksRouter from "./src/routes/webhooks.routes.js";

const app = express();

/** ───────────── Middlewares base ───────────── **/
app.use(cors());

// ⚠️ Importante: el webhook de Stripe usa express.raw() y debe declararse
// ANTES de app.use(express.json()) para que no se consuma el raw body.
app.use("/api/webhooks", webhooksRouter);

// JSON global para el resto de rutas
app.use(express.json());

// Static (mini-frontend público si lo necesitás)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));

/** ───────────── Healthcheck ───────────── **/
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGO_URI,
    dbState: mongoose.connection.readyState, // 0=disc,1=con,2=connecting,3=disconnecting
    payments: "stripe",
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
  });
});

/** ───────────── Rutas API ───────────── **/
app.use("/api/auth", authRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/guides", guidesRouter);
app.use("/api/orders", ordersRouter);

/** ───────────── DB + Server ───────────── **/
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.warn("⚠️  MONGO_URI no está definido. El server arrancará SIN DB.");
    } else {
      await mongoose.connect(mongoUri);
      console.log("✅ MongoDB conectado");
    }
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `✅ Express ON http://127.0.0.1:${PORT} NODE_ENV=${process.env.NODE_ENV || "dev"}`
      );
    });
  } catch (err) {
    console.error("❌ Error al iniciar el servidor:", err);
    process.exit(1);
  }
}

start();
