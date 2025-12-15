import express from "express";
import Guide from "../models/Guide.js";

const router = express.Router();

// ===============================
// GET ALL GUIDES
// ===============================
router.get("/", async (req, res) => {
  try {
    const guides = await Guide.find().sort({ createdAt: -1 });
    return res.json({
      ok: true,
      count: guides.length,
      guides,
    });
  } catch (err) {
    console.error("GET /api/guides error:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
});

// ===============================
// GET GUIDE BY ID
// ===============================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const guide = await Guide.findById(id);

    if (!guide) {
      return res.status(404).json({
        ok: false,
        error: "Guide not found",
      });
    }

    return res.json({
      ok: true,
      guide,
    });
  } catch (err) {
    console.error("GET /api/guides/:id error:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
});

export default router;
