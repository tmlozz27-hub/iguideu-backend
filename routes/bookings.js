import express from "express";
import Booking from "../models/Booking.js";

const router = express.Router();

// GET /api/bookings -> últimas reservas
router.get("/", async (req, res) => {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const formatted = bookings.map((b) => ({
      guideName: b.guideName,
      city: b.city,
      country: b.country,
      duration: b.duration || "",
      total: typeof b.total === "number" ? b.total : null,
      extra: b.extra || null,
      email: b.email || null,
      paymentStatus: b.paymentStatus || "PENDING",
      createdAt: b.createdAt,
    }));

    return res.json({ ok: true, bookings: formatted });
  } catch (err) {
    console.error("Error listando bookings", err);
    return res
      .status(500)
      .json({ ok: false, error: "Error obteniendo reservas" });
  }
});

// POST /api/bookings/demo -> crear una reserva demo rápida (opcional)
router.post("/demo", async (req, res) => {
  try {
    const booking = await Booking.create({
      guideName: "Demo – Bangkok Local Guide",
      city: "Bangkok",
      country: "Tailandia",
      duration: "DAY (8 hs)",
      total: 110,
      email: "test+booking@iguideu.com",
      paymentStatus: "PENDING",
      extra: "Reserva demo creada desde /api/bookings/demo",
    });

    return res.status(201).json({ ok: true, bookingId: booking._id });
  } catch (err) {
    console.error("Error creando booking demo", err);
    return res
      .status(500)
      .json({ ok: false, error: "Error creando reserva demo" });
  }
});

// PUT /api/bookings/:id/mark-paid -> marcar como pagada
router.put("/:id/mark-paid", async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByIdAndUpdate(
      id,
      { paymentStatus: "PAID" },
      { new: true }
    ).lean();

    if (!booking) {
      return res
        .status(404)
        .json({ ok: false, error: "Reserva no encontrada" });
    }

    return res.json({ ok: true, booking });
  } catch (err) {
    console.error("Error marcando booking como PAID", err);
    return res
      .status(500)
      .json({ ok: false, error: "Error actualizando reserva" });
  }
});

export default router;
