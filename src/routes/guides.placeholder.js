import express from "express";

const router = express.Router();

/**
 * IMPORTANTE:
 * server.js monta esto en /api/guides
 * => acá adentro las rutas son "/", "/ping", etc.
 */

// ping simple (sin DB) para verificar que el router responde
router.get("/ping", (req, res) => {
  return res.status(200).json({ ok: true, route: "guides", time: new Date().toISOString() });
});

// lista simple (placeholder) para destrabar el frontend YA
router.get("/", (req, res) => {
  return res.status(200).json({
    ok: true,
    count: 3,
    guides: [
      { id: "g1", name: "Guía 1", city: "Ciudad", rating: 4.8, languages: ["ES", "EN"] },
      { id: "g2", name: "Guía 2", city: "Ciudad", rating: 4.6, languages: ["ES"] },
      { id: "g3", name: "Guía 3", city: "Ciudad", rating: 4.9, languages: ["EN"] },
    ],
  });
});

export default router;
