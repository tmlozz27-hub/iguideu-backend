import express from "express";
import Booking from "../models/Booking.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/health", (req, res) => res.status(200).json({ ok: true }));

router.get("/", requireAuth, async (req, res) => {
  try {
    const travelerEmail = String(req.user?.email || "")
      .trim()
      .toLowerCase();

    if (!travelerEmail) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED"
      });
    }

    const list = await Booking.find({
      $or: [{ travelerEmail }, { email: travelerEmail }]
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.status(200).json({
      ok: true,
      items: list,
      count: list.length
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "RESERVATIONS_LIST_FAILED"
    });
  }
});

export default router;