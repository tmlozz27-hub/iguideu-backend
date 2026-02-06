import express from "express";
import mongoose from "mongoose";

const router = express.Router();

function pickBookingModel() {
  // Intenta cargar el modelo desde distintas rutas comunes
  const candidates = [
    "../../models/Booking.js",
    "../models/Booking.js",
    "../../src/models/Booking.js",
    "../models/booking.model.js",
    "../../models/booking.model.js",
  ];

  for (const rel of candidates) {
    try {
      // eslint-disable-next-line no-undef
      const mod = require(rel);
      const m = mod?.default || mod?.Booking || mod;
      if (m) return m;
    } catch {}
  }

  // Fallback: si ya está registrado en mongoose
  try {
    return mongoose.model("Booking");
  } catch {
    return null;
  }
}

const Booking = pickBookingModel();

router.get("/", async (req, res) => {
  try {
    const email = String(req.query?.email || "");
    if (!Booking) {
      return res.status(200).json({ ok: true, source: "memory", email, bookings: [] });
    }

    if (!email) {
      const list = await Booking.find({}).sort({ createdAt: -1 }).limit(50);
      return res.status(200).json({ ok: true, source: "db", email: null, bookings: list });
    }

    const list = await Booking.find({ travelerEmail: email }).sort({ createdAt: -1 });
    return res.status(200).json({ ok: true, source: "db", email, bookings: list });
  } catch (e) {
    return res.status(500).json({ error: "BOOKINGS_LIST_FAILED", message: e?.message || String(e) });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!Booking) {
      return res.status(500).json({ error: "BOOKING_MODEL_MISSING" });
    }

    // Aceptamos aliases para no romper el frontend / scripts:
    const travelerEmail = String(req.body?.travelerEmail || req.body?.email || "");
    const guideName = String(req.body?.guideName || req.body?.name || "Demo Guide");
    const guideId = String(req.body?.guideId || "");
    const startDate = String(req.body?.startDate || "");
    const durationHours = Number(req.body?.durationHours || 0);
    const amount = Number(req.body?.amount || 0);
    const currency = String(req.body?.currency || "usd").toLowerCase();

    const doc = await Booking.create({
      travelerEmail,
      guideName,
      guideId: guideId || undefined,
      startDate: startDate || undefined,
      durationHours: durationHours || undefined,
      amount,
      currency,
      status: "PENDING",
    });

    return res.status(201).json({ ok: true, bookingId: doc._id, booking: doc });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "BOOKING_CREATE_FAILED", message: e?.message || String(e) });
  }
});

export default router;
