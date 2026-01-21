import express from "express";

const router = express.Router();

/**
 * server.js monta esto en /api/guides
 * rutas reales:
 *   GET /api/guides
 *   GET /api/guides/ping
 */

// sanity check
router.get("/ping", (req, res) => {
  res.json({
    ok: true,
    route: "guides",
    time: new Date().toISOString(),
  });
});

// LISTA SIMPLE (SIN DB) – NO SE ROMPE
router.get("/", (req, res) => {
  res.json({
    ok: true,
    count: 3,
    guides: [
      {
        id: "g1",
        name: "Guía 1",
        city: "Ciudad",
        rating: 4.8,
        languages: ["ES", "EN"],
      },
      {
        id: "g2",
        name: "Guía 2",
        city: "Ciudad",
        rating: 4.6,
        languages: ["ES"],
      },
      {
        id: "g3",
        name: "Guía 3",
        city: "Ciudad",
        rating: 4.9,
        languages: ["EN"],
      },
    ],
  });
});

export default router;
