// routes/guides.cjs – rutas de guías en CommonJS

const express = require("express");
const Guide = require("../models/Guide.cjs");

const router = express.Router();

// GET /api/guides - lista todos los guías activos
router.get("/", async (req, res) => {
  try {
    const guides = await Guide.find({ isActive: { $ne: false } }).sort({
      name: 1,
    });

    res.json({
      ok: true,
      total: guides.length,
      guides,
    });
  } catch (err) {
    console.error("Error en GET /api/guides:", err);
    res.status(500).json({
      ok: false,
      error: "Error interno al obtener guías",
    });
  }
});

module.exports = router;
