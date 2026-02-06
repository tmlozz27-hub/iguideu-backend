import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ======================
   CORS
====================== */
app.use(cors());

/* ======================
   RAW body SOLO para Stripe webhook
====================== */
app.use((req, res, next) => {
  if (req.originalUrl === "/api/stripe/webhook") {
    next();
  } else {
    express.json({ limit: "2mb" })(req, res, next);
  }
});

/* ======================
   ENV
====================== */
const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 10000);

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  null;

/* ======================
   MONGO
====================== */
if (MONGO_URI) {
  try {
    await mongoose.connect(MONGO_URI, { autoIndex: false });
    console.log("[mongo] ✅ connected. readyState=", mongoose.connection.readyState);
  } catch (e) {
    console.log("[mongo] ❌ connect failed:", e?.message || e);
  }
} else {
  console.log("[mongo] ⚠️ no MONGO_URI");
}

/* ======================
   HEALTH
====================== */
app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "backend-iguideu-24",
    ts: new Date().toISOString(),
    dbState: mongoose.connection?.readyState ?? 0,
  });
});

/* ======================
   ROUTE LOADER
====================== */
async function mountIfExists(prefix, relFile) {
  const full = path.join(__dirname, relFile);
  if (!fs.existsSync(full)) {
    console.log("[ROUTES] missing ->", relFile);
    return;
  }
  try {
    const mod = await import(full);
    const router = mod?.default || mod?.router || mod;
    if (router) {
      app.use(prefix, router);
      console.log("[ROUTES] mounted ->", prefix, "from", relFile);
    } else {
      console.log("[ROUTES] invalid export ->", relFile);
    }
  } catch (e) {
    console.log("[ROUTES] failed ->", relFile, e?.message || e);
  }
}

/* ======================
   ROUTES
====================== */
await mountIfExists("/api/auth", "./routes/auth.routes.js");
await mountIfExists("/api/guides", "./routes/guides.routes.js");
await mountIfExists("/api/bookings", "./routes/bookings.routes.js");
await mountIfExists("/api/payments", "./routes/payments.routes.js");
await mountIfExists("/api/stripe", "./routes/stripe.webhook.routes.js");

/* ======================
   404
====================== */
app.use((_req, res) => {
  res.status(404).json({ error: "NOT_FOUND" });
});

/* ======================
   LISTEN
====================== */
app.listen(PORT, HOST, () => {
  console.log("Server ON -> http://" + HOST + ":" + PORT);
});
