import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

/** ───── Rutas existentes (si alguna no la tenés, dejala comentada) ───── **/
import authRouter from "./src/routes/auth.routes.js";
import bookingsRouter from "./src/routes/bookings.routes.js";
import adminRouter from "./src/routes/admin.routes.js";
import guidesRouter from "./src/routes/guides.routes.js";

/** ───── NUEVAS rutas ───── **/
import ordersRouter from "./src/routes/orders.routes.js";
import webhooksRouter from "./src/routes/webhooks.routes.js";

const app = express();
app.use(cors());

/** ⚠️ Webhooks Stripe: usar RAW antes del json global */
app.use("/api/webhooks", webhooksRouter);

/** JSON global para el resto de rutas */
app.use(express.json());

/** Static (opcional) */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));

/** Health */
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

/** Rutas API */
if (authRouter) app.use("/api/auth", authRouter);
if (bookingsRouter) app.use("/api/bookings", bookingsRouter);
if (adminRouter) app.use("/api/admin", adminRouter);
if (guidesRouter) app.use("/api/guides", guidesRouter);
app.use("/api/orders", ordersRouter); // Orders montado

/** (Opcional) Debug de rutas para verificar en Render */
app.get("/api/_routes", (req, res) => {
  const walk = (stack, base = "") =>
    stack.flatMap((l) => {
      if (l.route && l.route.path) {
        const methods = Object.keys(l.route.methods).filter(Boolean);
        return [{ path: base + l.route.path, methods }];
      }
      if (l.name === "router" && l.handle?.stack) {
        const prefix = (l.regexp?.source || "")
          .replace("^\\", "")
          .replace("\\/?(?=\\/|$)", "")
          .replace(/\\\//g, "/")
          .replace(/\$$/, "");
        return walk(l.handle.stack, base + (prefix || ""));
      }
      return [];
    });
  res.json(walk(app._router.stack));
});

/** DB + Server */
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (mongoUri) {
      await mongoose.connect(mongoUri);
      console.log("✅ MongoDB conectado");
    } else {
      console.warn("⚠️ MONGO_URI no está definido. Arranco sin DB.");
    }
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Express ON :${PORT} NODE_ENV=${process.env.NODE_ENV || "dev"}`);
    });
  } catch (err) {
    console.error("❌ Error al iniciar:", err);
    process.exit(1);
  }
}

start();
// touch 2025-09-28T15:09:18.7196436-03:00
