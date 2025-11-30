// src/routes/guides.js
import express from "express";
import Guide from "../models/Guide.js";

const router = express.Router();

// GET /api/guides -> lista de guías activas
router.get("/", async (req, res) => {
  try {
    const guides = await Guide.find({
      $or: [{ isActive: { $exists: false } }, { isActive: true }],
    })
      .sort({ rating: -1 })
      .lean();

    return res.json({
      ok: true,
      guides,
    });
  } catch (err) {
    console.error("❌ Error obteniendo guías:", err);
    return res.status(500).json({
      ok: false,
      error: "Error obteniendo guías.",
    });
  }
});

export default router;
