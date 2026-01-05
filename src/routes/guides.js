import express from "express";
import mongoose from "mongoose";

const router = express.Router();

/**
 * Normaliza un documento de guía (soporta tus 2 esquemas):
 * - esquema viejo: hourlyRate/dailyRate/priceHour/priceDay/rating/id
 * - esquema nuevo/otro: pricePerHourUsd/pricePerDayUsd + otros
 */
function normalizeGuide(g) {
  const hourly =
    g.hourlyRate ??
    g.priceHour ??
    g.priceHourUsd ??
    g.pricePerHourUsd ??
    g.price_per_hour ??
    0;

  const daily =
    g.dailyRate ??
    g.priceDay ??
    g.priceDayUsd ??
    g.pricePerDayUsd ??
    g.price_per_day ??
    0;

  const rating = g.rating ?? null;

  return {
    ...g,
    rating,
    hourlyRate: Number(hourly) || 0,
    dailyRate: Number(daily) || 0,
    priceHour: g.priceHour ?? (Number(hourly) || 0),
    priceDay: g.priceDay ?? (Number(daily) || 0),
  };
}

/**
 * Regla anti “draft/rotos”:
 * si no tiene id, rating null y tarifas 0/0 -> NO se muestra
 * (esto saca tu Sofía 0/0 de la lista sin tocar DB)
 */
function isValidGuide(g) {
  const hasId = !!g.id;
  const hourly = Number(g.hourlyRate || 0);
  const daily = Number(g.dailyRate || 0);
  const hasRates = hourly > 0 || daily > 0;
  const hasRating = g.rating !== null && g.rating !== undefined;

  // Si no tiene id, no tiene rating y no tiene tarifas -> lo consideramos “draft”
  if (!hasId && !hasRating && !hasRates) return false;

  return true;
}

router.get("/", async (req, res) => {
  try {
    const colName = req.app.locals.GUIDE_COLLECTION || "guides";
    const col = mongoose.connection.db.collection(colName);

    const docs = await col.find({}).toArray();

    const guides = docs
      .map((d) => normalizeGuide(d))
      .filter((d) => isValidGuide(d));

    return res.json({ ok: true, guides });
  } catch (err) {
    console.error("GET /api/guides error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});

export default router;
