// src/routes/bookings.routes.js
import { Router } from "express";
import authRequired from "../middlewares/authRequired.js";
import Booking from "../models/Booking.js";

const router = Router();

// Crear booking
router.post("/", authRequired, async (req, res) => {
  try {
    const { guide, startAt, endAt, price } = req.body || {};
    if (!guide || !startAt || !endAt || !price) {
      return res.status(400).json({ error: "bad_request" });
    }

    // solape simple
    const overlap = await Booking.findOne({
      guide,
      status: { $in: ["pending", "confirmed"] },
      $or: [{ startAt: { $lt: new Date(endAt) }, endAt: { $gt: new Date(startAt) } }],
    });

    if (overlap) {
      return res.status(409).json({ error: "overlap", hint: "Ya hay una reserva activa en ese rango" });
    }

    const booking = await Booking.create({
      traveler: req.user.id, // << CLAVE
      guide,
      startAt,
      endAt,
      price,
      status: "pending",
      payment: { status: "pending", feePct: 10, feeAmount: 0, netAmount: 0 },
    });

    return res.json({ booking });
  } catch (err) {
    console.warn(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// Mis bookings
router.get("/me", authRequired, async (req, res) => {
  const list = await Booking.find({ traveler: req.user.id }).sort({ createdAt: -1 });
  return res.json({ count: list.length, bookings: list });
});

export default router;
