import express from "express";
import Booking from "../models/Booking.js";

const router = express.Router();

function pickEmail(req) {
  const q = (req.query && (req.query.travelerEmail || req.query.email)) || "";
  const h = (req.headers && (req.headers["x-traveler-email"] || req.headers["x-email"])) || "";
  const b = (req.body && (req.body.travelerEmail || req.body.email)) || "";
  return String(q || h || b || "").trim();
}

router.get("/health", (req, res) => res.status(200).json({ ok: true }));

router.get("/", async (req, res) => {
  try {
    const travelerEmail = pickEmail(req);
    if (!travelerEmail) return res.status(400).json({ ok: false, error: "EMAIL_REQUIRED" });

    const list = await Booking.find({
      $or: [{ travelerEmail }, { email: travelerEmail }]
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.status(200).json({ ok: true, items: list, count: list.length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "RESERVATIONS_LIST_FAILED" });
  }
});

export default router;