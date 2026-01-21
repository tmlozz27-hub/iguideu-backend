// src/routes/bookings.routes.js
import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";

const router = Router();

// GET /api/bookings?email=
router.get("/", async (req, res) => {
  try {
    const email = (req.query.email || "").toString().trim();
    const q = email ? { travelerEmail: email } : {};
    const items = await Booking.find(q).sort({ createdAt: -1 }).limit(200).lean();
    return res.json(items);
  } catch (e) {
    return res.status(500).json({ ok: false, error: "BOOKINGS_LIST_FAIL" });
  }
});

// POST /api/bookings
router.post("/", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ ok: false, error: "DB_NOT_READY" });
    }

    const b = req.body || {};
    const travelerEmail = (b.travelerEmail || "").toString().trim();
    const guideName = (b.guideName || "").toString().trim();

    if (!travelerEmail) return res.status(400).json({ ok: false, error: "MISSING_TRAVELER_EMAIL" });
    if (!guideName) return res.status(400).json({ ok: false, error: "MISSING_GUIDE_NAME" });

    const doc = await Booking.create({
      travelerEmail,
      guideName,
      city: (b.city || "").toString(),
      country: (b.country || "").toString(),
      duration: (b.duration || "HOURS").toString(),
      hours: Number(b.hours || 0),
      total: Number(b.total || 0),
      status: (b.status || "PENDING").toString(),
    });

    return res.status(201).json({ ok: true, id: doc._id.toString() });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "BOOKING_CREATE_FAIL" });
  }
});

export default router;
