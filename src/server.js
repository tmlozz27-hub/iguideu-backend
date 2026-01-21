// src/server.js (ENTERO) - FIX /api/guides DIRECTO + dotenv/config
import "dotenv/config";

import express from "express";
import cors from "cors";
import morgan from "morgan";
import { MongoClient, ObjectId } from "mongodb";

// ======= FATAL LOGS =======
process.on("uncaughtException", (err) => console.error("[FATAL] uncaughtException:", err));
process.on("unhandledRejection", (reason) => console.error("[FATAL] unhandledRejection:", reason));

// ======= APP =======
const app = express();

// ======= CORS =======
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin,
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  morgan((tokens, req, res) => {
    const method = tokens.method(req, res);
    const url = tokens.url(req, res);
    const status = tokens.status(req, res);
    const ms = tokens["response-time"](req, res);
    const host = req.headers.host || "";
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    return `[REQ] ${method} ${url} status=${status} ms=${ms} host=${host} ip=${ip}`;
  })
);

// ======= BASIC ROUTES =======
app.get("/api/health", (_req, res) => res.status(200).json({ ok: true, ts: new Date().toISOString() }));

app.get("/api/__whoami", (req, res) => {
  res.status(200).json({
    ok: true,
    host: req.headers.host || null,
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || null,
    ua: req.headers["user-agent"] || null,
    ts: new Date().toISOString(),
  });
});

// ======= MONGO =======
let _client = null;

async function getDb() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("FALTA MONGO_URI/MONGODB_URI en .env");

  if (!_client) {
    _client = new MongoClient(uri);
    await _client.connect();
  }

  const dbName = process.env.DB_NAME || undefined; // si no está, usa la del URI
  return _client.db(dbName);
}

// ======= GUIDES (DIRECT) =======
app.get("/api/guides", async (_req, res) => {
  try {
    const db = await getDb();
    const guides = await db.collection("guides").find({}).limit(500).toArray();
    return res.status(200).json(guides);
  } catch (e) {
    console.error("[GUIDES] FAIL:", e);
    return res.status(500).json({ error: e?.message || "guides failed" });
  }
});

app.get("/api/guides/:id", async (req, res) => {
  try {
    const db = await getDb();
    const id = (req.params.id || "").trim();
    const q = /^[a-f0-9]{24}$/i.test(id) ? { _id: new ObjectId(id) } : { _id: id };
    const guide = await db.collection("guides").findOne(q);
    if (!guide) return res.status(404).json({ error: "guide not found" });
    return res.status(200).json(guide);
  } catch (e) {
    console.error("[GUIDE] FAIL:", e);
    return res.status(500).json({ error: e?.message || "guide failed" });
  }
});

// ======= ROUTE LOADER (bookings/chat/auth) =======
async function safeImport(path) {
  try {
    const mod = await import(path);
    const r = mod?.default || mod?.router || mod;
    if (!r) throw new Error("router export vacío");
    return { ok: true, router: r };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

async function mountRoutes() {
  // Bookings
  {
    const r = await safeImport("./routes/bookings.routes.js");
    if (r.ok) {
      app.use("/api/bookings", r.router);
      console.log("Routes OK -> bookings mounted at /api/bookings");
    } else {
      console.warn(`[WARN] Router missing or failed: ./routes/bookings.routes.js -> using fallback (${r.error})`);
      app.get("/api/bookings", (_req, res) => res.status(500).json({ error: "bookings route missing", detail: r.error }));
      app.post("/api/bookings", (_req, res) => res.status(500).json({ error: "bookings route missing", detail: r.error }));
      console.log("Routes OK -> bookings mounted at /api/bookings (fallback)");
    }
  }

  // Chat
  {
    const r = await safeImport("./routes/chat.routes.js");
    if (r.ok) {
      app.use("/api/chat", r.router);
      console.log("Routes OK -> chat mounted at /api/chat");
    } else {
      console.warn(`[WARN] Router missing or failed: ./routes/chat.routes.js -> using fallback (${r.error})`);
      app.get("/api/chat", (_req, res) => res.status(200).json({ ok: true, messages: [] }));
      console.log("Routes OK -> chat mounted at /api/chat (fallback)");
    }
  }

  // Auth
  {
    const r = await safeImport("./routes/auth.routes.js");
    if (r.ok) {
      app.use("/api/auth", r.router);
      console.log("Routes OK -> auth mounted at /api/auth");
    } else {
      console.warn(`[WARN] Router missing or failed: ./routes/auth.routes.js -> using fallback (${r.error})`);
      app.get("/api/auth", (_req, res) => res.status(200).json({ ok: true }));
      console.log("Routes OK -> auth mounted at /api/auth (fallback)");
    }
  }
}

// ======= 404 JSON =======
app.use((req, res) => res.status(404).json({ error: "not found", path: req.path }));

// ======= ERROR JSON =======
app.use((err, req, res, _next) => {
  console.error("[ERR] middleware:", err);
  res.status(500).json({ error: err?.message || "internal error", path: req?.path || null });
});

// ======= START =======
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4020);

await mountRoutes();

app.listen(PORT, HOST, () => {
  console.log("Routes OK -> guides mounted at /api/guides (DIRECT)");
  console.log(`Mongo env? MONGO_URI=${!!(process.env.MONGO_URI || process.env.MONGODB_URI)} DB_NAME=${process.env.DB_NAME || "(uri-default)"}`);
  console.log(`Server ON -> http://${HOST}:${PORT}`);
});
