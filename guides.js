import express from "express";
import Guide from "../models/Guide.js";

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

export default router;
