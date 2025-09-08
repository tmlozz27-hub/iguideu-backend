import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// Crear booking (protegido)
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { guide, startAt, endAt, price } = req.body;

    // Chequeo básico
    if (!guide || !startAt || !endAt || !price) {
      return res.status(400).json({ error: "bad_request" });
    }

    // Evitar solapes simples para el mismo guide
    const overlap = await Booking.exists({
      guide,
      status: { $in: ["pending", "confirmed"] },
      $or: [
        { startAt: { $lt: new Date(endAt) }, endAt: { $gt: new Date(startAt) } },
      ],
    });
    if (overlap) {
      return res.status(409).json({ error: "overlap", hint: "Ya hay una reserva activa en ese rango" });
    }

    const booking = await Booking.create({
      traveler: new mongoose.Types.ObjectId(req.user.id),
      guide,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      price,
      status: "pending",
      payment: { status: "authorized", feePct: 10, feeAmount: 0, netAmount: 0 },
    });

    return res.json({ booking });
  } catch (err) {
    console.warn(err);
    return next(err);
  }
});

// Mis bookings (protegido)
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const docs = await Booking.find({ traveler: req.user.id }).sort({ createdAt: -1 }).lean();
    return res.json({ count: docs.length, bookings: docs });
  } catch (err) {
    return next(err);
  }
});

export default router;
