import express from "express";
import Booking from "../models/Booking.js";
import Guide from "../models/Guide.js";

const router = express.Router();

const clampInt = (v, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < min || i > max) return null;
  return i;
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

function calcTotalUsdFromGuide(guide, hours) {
  const h = hours;

  if (h === 24) return Number(guide.fullDay24hRateUsd ?? 0);
  if (h >= 8) return Number(guide.dayRateUsd ?? 0);
  return Number(guide.hourlyRateUsd ?? 0) * h;
}

// ✅ Crear booking (SEGURIDAD: el total se calcula SOLO en backend)
router.post("/", async (req, res) => {
  try {
    const guideId = String(req.body?.guideId || "").trim();
    const travelerEmail = normalizeEmail(req.body?.travelerEmail);
    const hoursRequested = clampInt(req.body?.hoursRequested, 1, 24);

    if (!guideId) {
      return res.status(400).json({ ok: false, error: "guideId requerido" });
    }
    if (!travelerEmail || !travelerEmail.includes("@")) {
      return res
        .status(400)
        .json({ ok: false, error: "travelerEmail inválido" });
    }
    if (!hoursRequested) {
      return res
        .status(400)
        .json({ ok: false, error: "hoursRequested inválido (1..24)" });
    }

    const guide = await Guide.findById(guideId);
    if (!guide) {
      return res.status(404).json({ ok: false, error: "Guía no encontrado" });
    }

    // 🔒 TOTAL SOLO EN BACKEND (no confiamos en frontend)
    const totalUsd = calcTotalUsdFromGuide(guide, hoursRequested);

    if (!Number.isFinite(totalUsd) || totalUsd <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Tarifas del guía inválidas (totalUsd <= 0)",
      });
    }

    // Duración
    const durationType =
      hoursRequested === 24 ? "FULL_DAY_24H" : hoursRequested >= 8 ? "DAY" : "HOURS";

    const booking = await Booking.create({
      guideId: guide._id.toString(),
      guideName: guide.name,
      travelerEmail,
      hoursRequested,
      durationType,
      totalUsd,
      paymentStatus: "pending",
    });

    return res.status(200).json({ ok: true, bookingId: booking._id, booking });
  } catch (e) {
    console.error("❌ POST /api/bookings error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ✅ Listar bookings por email (para pantalla "Mis Reservas")
router.get("/", async (req, res) => {
  try {
    const email = normalizeEmail(req.query?.email);
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "email inválido" });
    }

    const bookings = await Booking.find({ travelerEmail: email })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({ ok: true, bookings });
  } catch (e) {
    console.error("❌ GET /api/bookings error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
