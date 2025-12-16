// routes/bookings.js — POST REAL (modo demo, sin Stripe)
// ✅ Crea reserva en Mongo
// ✅ GET por email

import express from "express";

const router = express.Router();

async function loadBookingModel() {
  const tries = [
    "../models/Booking.js",
    "../models/booking.js",
    "../src/models/Booking.js",
    "../src/models/booking.js",
  ];

  for (const p of tries) {
    try {
      const mod = await import(p);
      const Booking = mod?.default || mod?.Booking || null;
      if (Booking) return Booking;
    } catch {}
  }
  return null;
}

// ===== GET /api/bookings?email= =====
router.get("/", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: "email requerido" });

    const Booking = await loadBookingModel();
    if (!Booking) return res.status(500).json({ ok: false, error: "Booking model no encontrado" });

    const bookings = await Booking.find({ $or: [{ email }, { travelerEmail: email }] })
      .sort({ createdAt: -1 })
      .limit(200);

    return res.json({ ok: true, bookings });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "error listando reservas", details: String(e.message || e) });
  }
});

// ===== POST /api/bookings =====
router.post("/", async (req, res) => {
  try {
    const { guideId, guideName, city, country, email, hours, dayType, totalUsd } = req.body || {};

    if (!guideId || !guideName || !email || totalUsd === undefined || totalUsd === null) {
      return res.status(400).json({ ok: false, error: "faltan campos obligatorios" });
    }

    const Booking = await loadBookingModel();
    if (!Booking) return res.status(500).json({ ok: false, error: "Booking model no encontrado" });

    const booking = await Booking.create({
      guideId,
      guideName,
      city: city || null,
      country: country || null,
      email: String(email).toLowerCase(),
      hours: hours ?? null,
      dayType: dayType || "HOURS",
      totalUsd,
      paymentStatus: "pending", // ✅ FIX: enum acepta minúscula
      source: "APP",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return res.status(201).json({ ok: true, booking });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "error creando reserva", details: String(e.message || e) });
  }
});

export default router;

