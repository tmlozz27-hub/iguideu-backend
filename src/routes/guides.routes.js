// src/routes/guides.routes.js
import express from "express";
import mongoose from "mongoose";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const db = mongoose.connection?.db;
    if (!db) return res.status(500).json({ error: "Mongo not connected" });

    // traemos todo lo activo; si no hay filtro, igual devolvemos todo
    const col = db.collection("guides");

    // Si tus docs tienen active:true, lo usamos. Si no, devolvemos todo.
    const count = await col.countDocuments();
    const query = count > 0 ? { $or: [{ active: true }, { active: { $exists: false } }] } : {};

    const docs = await col.find(query).sort({ updatedAt: -1, createdAt: -1 }).limit(200).toArray();
    return res.json(docs);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "guides error" });
  }
});

export default router;
