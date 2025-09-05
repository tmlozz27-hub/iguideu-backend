import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// Crear booking
router.post("/", requireAuth, async (req, res) => {
  try {
    const { guide, startAt, endAt, price } = req.body || {};
    if (!guide || !startAt || !endAt) {
      return res.status(400).json({ error: "missing fields" });
    }

    const Booking = global.models.Booking;
    const s = new Date(startAt);
    const e = new Date(endAt);

    // solapamiento (pending/confirmed)
    const overlap = await Booking.findOne({
      guide,
      status: { $in: ["pending", "confirmed"] },
      $or: [{ startAt: { $lt: e }, endAt: { $gt: s } }],
    }).lean();

    if (overlap) return res.status(409).json({ error: "overlap" });

    const booking = await Booking.create({
      traveler: req.user._id,
      guide,
      startAt: s,
      endAt: e,
      price,
      status: "pending",
    });

    res.status(201).json({ booking });
  } catch (err) {
    console.error("POST /bookings error:", err);
    res.status(500).json({ error: "internal error" });
    return;
  }
});

// Confirmar
router.patch("/:id/confirm", requireAuth, async (req, res) => {
  const Booking = global.models.Booking;
  const b = await Booking.findByIdAndUpdate(
    req.params.id,
    { status: "confirmed" },
    { new: true }
  );
  if (!b) return res.status(404).json({ error: "not found" });
  res.json({ booking: b });
});

// Cancelar
router.patch("/:id/cancel", requireAuth, async (req, res) => {
  const Booking = global.models.Booking;
  const b = await Booking.findByIdAndUpdate(
    req.params.id,
    { status: "cancelled" },
    { new: true }
  );
  if (!b) return res.status(404).json({ error: "not found" });
  res.json({ booking: b });
});

// Listar del usuario
router.get("/", requireAuth, async (req, res) => {
  const Booking = global.models.Booking;
  const bookings = await Booking.find({ traveler: req.user._id })
    .sort({ startAt: 1 })
    .lean();
  res.json({ bookings });
});

export default router;
