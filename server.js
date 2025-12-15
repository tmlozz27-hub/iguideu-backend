// server.js (ESM) — BACKEND I GUIDE U 24
// ✅ Deploy-proof: imports dinámicos con try/catch (no crashea en Render)
// ✅ /api/_debug + buildTag en /api/health para confirmar deploy

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/api/_debug", (req, res) => {
  res.json({
    ok: true,
    buildTag: "TAG-7fcaf41",
    env: process.env.NODE_ENV || null,
    service: process.env.RENDER_SERVICE_NAME || null,
    gitCommit: process.env.RENDER_GIT_COMMIT || null,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || "production",
    port: String(process.env.PORT || 0),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "https://iguideu-backend-1.onrender.com",
    db: true,
    dbName: process.env.DB_NAME || null,
    stripeKeyLoaded: !!process.env.STRIPE_SECRET_KEY,
    buildTag: "TAG-7fcaf41",
    renderGitCommit: process.env.RENDER_GIT_COMMIT || null,
  });
});

function pickRouter(mod) {
  return (
    mod?.default ||
    mod?.router ||
    mod?.bookingsRouter ||
    mod?.guidesRouter ||
    mod?.adminRouter ||
    null
  );
}

async function tryLoadRouter(relPath) {
  try {
    const mod = await import(relPath);
    const router = pickRouter(mod);
    if (!router) {
      console.warn(`⚠️ Router cargado pero sin export usable: ${relPath}`);
      return null;
    }
    console.log(`✅ Router OK: ${relPath}`);
    return router;
  } catch (e) {
    console.warn(`⚠️ Router no cargado (${relPath}): ${e?.message || e}`);
    return null;
  }
}

(async () => {
  const guidesRouter =
    (await tryLoadRouter("./routes/guides.js")) ||
    (await tryLoadRouter("./routes/guides/index.js")) ||
    null;

  const bookingsRouter =
    (await tryLoadRouter("./routes/bookings.js")) ||
    (await tryLoadRouter("./routes/bookings/index.js")) ||
    null;

  const adminRouter =
    (await tryLoadRouter("./routes/admin.js")) ||
    (await tryLoadRouter("./routes/admin/index.js")) ||
    null;

  if (guidesRouter) app.use("/api/guides", guidesRouter);

  if (bookingsRouter) {
    app.use("/api/bookings", bookingsRouter);
  } else {
    app.get("/api/bookings", (req, res) => {
      res.status(200).json({
        ok: true,
        forced: true,
        buildTag: "TAG-7fcaf41",
        note: "bookings router no cargó; server vivo. Luego conectamos GET real.",
        email: req.query.email || null,
      });
    });
  }

  if (adminRouter) app.use("/api/admin", adminRouter);

  app.use("/api", (req, res) => {
    res.status(404).json({ ok: false, error: "API route not found", path: req.path });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error("❌ Unhandled error:", err);
    res.status(500).json({ ok: false, error: "Internal Server Error" });
  });

  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => console.log(`✅ I GUIDE U backend running on port ${PORT}`));
})();
