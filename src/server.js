import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 10000);

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  null;

if (MONGO_URI) {
  try {
    await mongoose.connect(MONGO_URI, { autoIndex: false });
    console.log("[mongo] ✅ connected. readyState=", mongoose.connection.readyState);
  } catch (e) {
    console.log("[mongo] ❌ connect failed:", e?.message || e);
  }
} else {
  console.log("[mongo] ⚠️ no MONGO_URI (running without db)");
}

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

await mountIfExists("/api/auth", "./routes/auth.routes.js");
await mountIfExists("/api/guides", "./routes/guides.routes.js");
await mountIfExists("/api/bookings", "./routes/bookings.routes.js");

await mountIfExists("/api/payments", "./routes/payments.routes.js");
await mountIfExists("/api/stripe", "./routes/stripe.webhook.routes.js");

app.use((_req, res) => {
  res.status(404).json({ error: "NOT_FOUND" });
});

app.listen(PORT, HOST, () => {
  console.log("Server ON -> http://" + HOST + ":" + PORT);
});
