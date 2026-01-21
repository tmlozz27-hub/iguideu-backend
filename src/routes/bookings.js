import express from "express";
import Booking from "../models/Booking.js";
import Guide from "../models/Guide.js";

const router = express.Router();

/**
 * GET /api/bookings?email=...
 * Devuelve reservas del usuario
 * BLINDADO:
 * - nombre del guía SIEMPRE viene desde Guides (UTF-8 correcto)
 * - ordenadas por createdAt desc
 */
router.get("/api/bookings", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "email required" });
    }

    // Traemos bookings
    const bookings = await Booking.find({ email })
      .sort({ createdAt: -1 })
      .lean();

    if (!bookings.length) {
      return res.json([]);
    }

    // Recolectar IDs de guías usados
    const guideIds = [
      ...new Set(
        bookings
          .map(b => b.guide || b.guideId || b.guide_id)
          .filter(Boolean)
          .map(id => id.toString())
      )
    ];

    // Traer guías reales
    const guides = await Guide.find({ _id: { $in: guideIds } }).lean();
    const guideMap = new Map(guides.map(g => [g._id.toString(), g]));

    // Normalizar salida
    const out = bookings.map(b => {
      const gid =
        (b.guide && b.guide.toString()) ||
        (b.guideId && b.guideId.toString()) ||
        (b.guide_id && b.guide_id.toString());

      const g = gid ? guideMap.get(gid) : null;

      return {
        ...b,
        guideName: g?.name || b.guideName || b.guideTitle || "",
        guideLocation: g?.location || b.location || "",
        guideLanguages: g?.languages || b.languages || [],
        guideRating: g?.rating ?? b.rating ?? null,
      };
    });

    res.json(out);
  } catch (err) {
    console.error("BOOKINGS ERROR:", err);
    res.status(500).json({ error: "internal error" });
  }
});

export default router;
