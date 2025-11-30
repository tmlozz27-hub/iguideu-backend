// src/routes/bookings.js
import express from "express";
import Booking from "../models/Booking.js";

const router = express.Router();

// Crea una booking en estado "pending"
router.post("/create", async (req, res) => {
  try {
    const {
      guideId,
      guideName,
      travelerName,
      travelerEmail,
      date,
      hours,
      amount,
      currency,
    } = req.body;

    if (
      !guideId ||
      !guideName ||
      !travelerName ||
      !travelerEmail ||
      !date ||
      !hours ||
      !amount
    ) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos obligatorios para crear la reserva.",
      });
    }

    const booking = await Booking.create({
      guideId,
      guideName,
      travelerName,
      travelerEmail,
      date,
      hours,
      amount,
      currency: currency || "usd",
      originalAmount: amount,
    });

    return res.json({ ok: true, booking });
  } catch (err) {
    console.error("❌ Error creando booking:", err);
    return res.status(500).json({
      ok: false,
      error: "Error creando reserva.",
    });
  }
});

// Obtener una booking por id
router.get("/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).lean();
    if (!booking) {
      return res.status(404).json({ ok: false, error: "Reserva no encontrada." });
    }
    return res.json({ ok: true, booking });
  } catch (err) {
    console.error("❌ Error obteniendo booking:", err);
    return res.status(500).json({ ok: false, error: "Error interno." });
  }
});

export default router;
