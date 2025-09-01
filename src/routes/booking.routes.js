// src/routes/booking.routes.js
const express = require("express");
const router = express.Router();
const { z } = require("zod");
const { validate } = require("../middlewares/validate");
const { requireAuth } = require("../middlewares/auth.middleware");
const { evaluateCancellation } = require("../policies/cancellation");
const { notifyBookingUpdate } = require("../utils/notifier");

// --- In-memory store (simple) ---
let BOOKINGS = []; // cada item: {_id, traveler, guide, startAt, endAt, price, status, history[], confirmAt?, cancelledAt?, cancelInfo?}

function newId() {
  return String(Date.now()) + String(Math.floor(Math.random() * 1000)).padStart(3, "0");
}

function overlap(a, b) {
  if (a.guide !== b.guide) return false;
  const aStart = new Date(a.startAt), aEnd = new Date(a.endAt);
  const bStart = new Date(b.startAt), bEnd = new Date(b.endAt);
  return aStart < bEnd && bStart < aEnd;
}

// --- Schemas ---
const createSchema = z.object({
  guide: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  price: z.number().nonnegative().default(0),
});

const cancelSchema = z.object({
  forceMajeure: z.boolean().optional(),
});

// --- Listado ---
router.get("/", requireAuth, (req, res) => {
  res.json({ ok: true, bookings: BOOKINGS });
});

// --- Crear ---
router.post("/", requireAuth, validate(createSchema), (req, res) => {
  const data = req.validated;
  const who = req.user?.email || "unknown";
  const booking = {
    _id: newId(),
    traveler: who,
    guide: data.guide,
    startAt: data.startAt,
    endAt: data.endAt,
    price: data.price ?? 0,
    status: "pending",
    history: [{ at: new Date().toISOString(), actor: who, action: "create" }],
  };
  BOOKINGS.push(booking);
  res.json({ ok: true, booking });
});

// --- Confirmar (idempotente) ---
router.patch("/:id/confirm", requireAuth, (req, res) => {
  const id = req.params.id;
  const booking = BOOKINGS.find((b) => b._id === id);
  if (!booking) return res.status(404).json({ error: "not_found" });

  if (booking.status === "confirmed") {
    return res.json({ ok: true, booking }); // idempotencia
  }
  if (booking.status === "cancelled") {
    return res.status(409).json({ error: "invalid_transition", from: "cancelled", to: "confirmed" });
  }

  // Chequear overlap solo contra confirmadas
  const conflict = BOOKINGS.find(
    (b) => b.status === "confirmed" && overlap(b, booking)
  );
  if (conflict) {
    return res.status(409).json({ error: "overlap", conflict });
  }

  booking.status = "confirmed";
  booking.confirmAt = new Date().toISOString();
  booking.history.push({ at: booking.confirmAt, actor: req.user?.email || "unknown", action: "confirm" });

  notifyBookingUpdate("confirmed", booking);
  res.json({ ok: true, booking });
});

// --- Cancelar (idempotente + política) ---
router.patch("/:id/cancel", requireAuth, validate(cancelSchema), (req, res) => {
  const id = req.params.id;
  const booking = BOOKINGS.find((b) => b._id === id);
  if (!booking) return res.status(404).json({ error: "not_found" });

  if (booking.status === "cancelled") {
    return res.json({ ok: true, booking }); // idempotencia
  }

  const actorRole = req.user?.role || "traveler";
  const who = actorRole === "guide" ? "guide" : "traveler";
  const forceMajeure = !!req.validated?.forceMajeure;

  const evalRes = evaluateCancellation({
    booking,
    who,
    now: new Date(),
    forceMajeure,
  });

  booking.status = "cancelled";
  booking.cancelledAt = new Date().toISOString();
  booking.cancelInfo = {
    actor: who,
    reason: evalRes.reason,
    travelerRefundPct: evalRes.travelerRefundPct,
    guidePenaltyPct: evalRes.guidePenaltyPct,
    hoursUntilStart: evalRes.hoursUntilStart,
  };
  booking.history.push({
    at: booking.cancelledAt,
    actor: req.user?.email || "unknown",
    role: who,
    action: "cancel",
    reason: evalRes.reason,
  });

  notifyBookingUpdate("cancelled", booking);
  res.json({ ok: true, booking });
});

// --- Debug reset (solo no-producción) ---
router.post("/debug/reset", requireAuth, (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "forbidden_in_production" });
  }
  BOOKINGS = [];
  res.json({ ok: true });
});

module.exports = router;
