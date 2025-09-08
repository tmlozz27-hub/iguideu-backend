import { Router } from "express";
import Booking from "../models/Booking.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// Mock authorize
router.post("/authorize/:id", requireAuth, async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, traveler: req.user.id });
    if (!booking) return res.status(404).json({ error: "not_found" });

    booking.payment = booking.payment || {};
    booking.payment.status = "authorized";
    booking.status = "pending";
    await booking.save();

    return res.json({ booking });
  } catch (err) {
    return next(err);
  }
});

// Mock capture
router.post("/capture/:id", requireAuth, async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, traveler: req.user.id });
    if (!booking) return res.status(404).json({ error: "not_found" });

    booking.payment = {
      status: "paid",
      feePct: 10,
      feeAmount: Math.round(booking.price * 0.10),
      netAmount: booking.price - Math.round(booking.price * 0.10),
      ref: `MOCK-CAP-${Date.now()}`,
    };
    booking.status = "confirmed";
    await booking.save();

    return res.json({ booking });
  } catch (err) {
    return next(err);
  }
});

// Mock refund
router.post("/refund/:id", requireAuth, async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, traveler: req.user.id });
    if (!booking) return res.status(404).json({ error: "not_found" });

    booking.payment.status = "refunded";
    booking.status = "cancelled";
    booking.payment.ref = `MOCK-REF-${Date.now()}`;
    await booking.save();

    return res.json({ booking });
  } catch (err) {
    return next(err);
  }
});

// Historial de pagos del viajero
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const docs = await Booking.find({ traveler: req.user.id, "payment.status": { $exists: true } })
      .select("_id guide status price payment startAt endAt createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const payments = docs.map(d => ({
      bookingId: d._id,
      guide: d.guide,
      status: d.status,
      price: d.price,
      payment: d.payment,
      period: { startAt: d.startAt, endAt: d.endAt },
      createdAt: d.createdAt,
    }));

    return res.json({ count: payments.length, payments });
  } catch (err) {
    return next(err);
  }
});

export default router;
