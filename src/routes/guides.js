import express from "express";
import mongoose from "mongoose";

const router = express.Router();

// Model mínimo (si ya existe otro modelo, después lo conectamos)
const GuideSchema =
  mongoose.models.Guide?.schema ||
  new mongoose.Schema(
    {
      name: { type: String, default: "" },
      city: { type: String, default: "" },
      country: { type: String, default: "" },
      languages: { type: [String], default: [] },
      rating: { type: Number, default: 0 },
      pricePerHour: { type: Number, default: 0 },
    },
    { timestamps: true }
  );

const Guide = mongoose.models.Guide || mongoose.model("Guide", GuideSchema);

// GET /api/guides
router.get("/", async (_req, res) => {
  try {
    const guides = await Guide.find({}).sort({ createdAt: -1 }).limit(200);
    res.json({ ok: true, guides });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
});

// POST /api/guides/seed  (para cargar ejemplos rápido)
router.post("/seed", async (_req, res) => {
  try {
    const seed = [
      { name: "Juan Pérez", city: "Buenos Aires", country: "Argentina", rating: 4.8 },
      { name: "María Gómez", city: "Barcelona", country: "España", rating: 4.6 },
    ];
    await Guide.deleteMany({});
    const created = await Guide.insertMany(seed);
    res.json({ ok: true, created: created.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
});

export default router;
