// src/server.js
import express from "express";
import cors from "cors";

const app = express();

// ====== SETTINGS ======
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4020);

// ====== MIDDLEWARE ======
app.set("trust proxy", true);
app.use(cors({ origin: "*", credentials: false }));
app.use(express.json({ limit: "2mb" }));

// ====== REQUEST LOG ======
app.use((req, res, next) => {
  const now = new Date().toISOString();
  const host = req.headers.host;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.log(
    `[REQ] ${now} ${req.method} host=${host} ip=${ip} url=${req.originalUrl} path=${req.path}`
  );
  next();
});

// ====== DEBUG ROUTES (para validar tunnel/origen) ======
app.get("/__whoami", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "backend-iguideu-24",
    host: req.headers.host,
    forwardedHost: req.headers["x-forwarded-host"],
    proto: req.headers["x-forwarded-proto"],
    ip: req.ip,
    url: req.originalUrl,
    time: new Date().toISOString(),
  });
});

app.get("/api/__whoami", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "backend-iguideu-24",
    host: req.headers.host,
    forwardedHost: req.headers["x-forwarded-host"],
    proto: req.headers["x-forwarded-proto"],
    ip: req.ip,
    url: req.originalUrl,
    time: new Date().toISOString(),
  });
});

// ====== HEALTH ======
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "backend-iguideu-24",
    time: new Date().toISOString(),
  });
});
console.log("Routes OK -> health mounted at /api/health");

// ====== TRY LOAD ROUTERS (sin romper si faltan) ======
async function tryLoadRouter(path) {
  try {
    const mod = await import(path);
    return mod?.default || null;
  } catch (e) {
    console.warn(`[WARN] Router missing or failed: ${path} -> using fallback`);
    return null;
  }
}

const guidesRouter = await tryLoadRouter("./routes/guides.routes.js");
const bookingsRouter = await tryLoadRouter("./routes/bookings.routes.js");
const chatRouter = await tryLoadRouter("./routes/chat.routes.js");
const authRouter = await tryLoadRouter("./routes/auth.routes.js");

// ====== MOUNT ROUTES ======
if (guidesRouter) {
  app.use("/api/guides", guidesRouter);
  console.log("Routes OK -> guides mounted at /api/guides");
} else {
  app.get("/api/guides", (req, res) => res.status(200).json([]));
  console.log("Routes OK -> guides mounted at /api/guides (fallback)");
}

if (bookingsRouter) {
  app.use("/api/bookings", bookingsRouter);
  console.log("Routes OK -> bookings mounted at /api/bookings");
} else {
  app.get("/api/bookings", (req, res) => res.status(200).json([]));
  app.post("/api/bookings", (req, res) =>
    res.status(200).json({ ok: true, created: true, payload: req.body || {} })
  );
  console.log("Routes OK -> bookings mounted at /api/bookings (fallback)");
}

if (chatRouter) {
  app.use("/api/chat", chatRouter);
  console.log("Routes OK -> chat mounted at /api/chat");
} else {
  app.get("/api/chat", (req, res) =>
    res.status(200).json({ ok: true, chat: "fallback" })
  );
  console.log("Routes OK -> chat mounted at /api/chat (fallback)");
}

if (authRouter) {
  app.use("/api/auth", authRouter);
  console.log("Routes OK -> auth mounted at /api/auth");
} else {
  app.get("/api/auth", (req, res) =>
    res.status(200).json({ ok: true, auth: "fallback" })
  );
  console.log("Routes OK -> auth mounted at /api/auth (fallback)");
}

// ====== 404 (API) ======
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

// ====== START ======
app.listen(PORT, HOST, () => {
  console.log(`Server ON -> http://${HOST}:${PORT}`);
});
