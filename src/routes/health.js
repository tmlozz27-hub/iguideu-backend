import express from "express";
const router = express.Router();

// GET /api/health  (ultra simple, SIEMPRE responde)
router.get("/", (_req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json({
    ok: true,
    service: "IGUIDEU BACKEND",
    route: "health",
    status: "online",
    time: new Date().toISOString(),
  });
});

// GET /api/health/ping
router.get("/ping", (_req, res) => {
  return res.status(200).json({ ok: true, route: "health", ping: true });
});

export default router;
