// routes/guides.js
// Lista de guías para el frontend viajero (I GUIDE U – Backend 24)

import express from "express";
import Guide from "../models/Guide.js";

const router = express.Router();

/**
 * GET /api/guides
 * Devuelve la lista pública de guías.
 *
 * Incluye:
 * - id, name, city, country
 * - rating
 * - priceHour, priceDay
 * - hourlyRate, dailyRate
 * - languages, description
 * - guideType ("OFFICIAL" | "INDEPENDENT")
 * - identityVerified (boolean)
 */
router.get("/", async (req, res) => {
  try {
    const guides = await Guide.find(
      { isActive: { $ne: false } }, // activo por defecto
      "id name city country rating priceHour priceDay hourlyRate dailyRate languages description guideType identityVerified"
    ).sort({ city: 1, name: 1 });

    return res.json({
      ok: true,
      guides,
    });
  } catch (err) {
    console.error("[ERROR] GET /api/guides:", err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

export default router;
