// src/routes/index.js
import { Router } from "express";

const router = Router();

// ===== DEV MEMORY (para que funcione YA en oficina/tunnel) =====
const mem = {
  guides: [],
  bookings: [],
  reservations: [],
};

// HEALTH (por api)
router.get("/health", (req, res) => {
  res.json({ ok: true });
});

// GUIDES (mock simple por ahora)
router.get("/guides", (req, res) => {
  res.json(mem.guides);
});

// BOOKINGS (listar por email si viene)
router.get("/bookings", (req, res) => {
  const email = String(req.query?.email || "").trim().toLowerCase();
  if (!email) return res.json(mem.bookings);
  return res.json(mem.bookings.filter((b) => String(b.travelerEmail || "").toLowerCase() === email));
});

// ✅ BOOKINGS (crear)  <<< ESTO TE ESTABA FALTANDO >>>
router.post("/bookings", (req, res) => {
  const body = req.body || {};

  const travelerEmail = String(body.travelerEmail || "").trim();
  if (!travelerEmail) {
    return res.status(400).json({ ok: false, error: "VALIDATION_ERROR", message: "travelerEmail requerido" });
  }

  const booking = {
    id: "bk_" + Date.now(),
    travelerEmail,
    guideName: String(body.guideName || ""),
    city: String(body.city || ""),
    country: String(body.country || ""),
    duration: String(body.duration || ""),
    hours: Number(body.hours || 0),
    total: Number(body.total || 0),
    createdAt: new Date().toISOString(),
    status: "PENDING",
    source: "dev-mem",
  };

  mem.bookings.unshift(booking);
  return res.status(201).json({ ok: true, booking });
});

// RESERVATIONS
router.get("/reservations", (req, res) => {
  res.json(mem.reservations);
});

export default router;

