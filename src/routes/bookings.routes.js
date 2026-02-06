import express from "express";
import Booking from "../models/Booking.js";

const router = express.Router();

/*
  GET /api/bookings?email=...
  - devuelve bookings por email si se pasa query
  - sino devuelve los últimos 50
*/
router.get("/", async (req, res) => {
  try {
    const email = typeof req.query.email === "string" ? req.query.email : "";
    const q = email ? { email } : {};
    const list = await Booking.find(q).sort({ createdAt: -1 }).limit(50);
    return res.status(200).json(list);
  } catch (e) {
    return res.status(500).json({ error: "BOOKINGS_LIST_FAILED", message: e?.message || String(e) });
  }
});

/*
  POST /api/bookings
  body: { email, guideId, startDate, durationHours, amount, currency }
*/
router.post("/", async (req, res) => {
  try {
    const email = String(req.body?.email || "");
    const guideId = String(req.body?.guideId || "");
    const startDate = String(req.body?.startDate || "");
    const durationHours = Number(req.body?.durationHours || 0);
    const amount = Number(req.body?.amount || 0);
    const currency = String(req.body?.currency || "usd").toLowerCase();

    if (!email) return res.status(400).json({ error: "EMAIL_REQUIRED" });
    if (!guideId) return res.status(400).json({ error: "GUIDE_ID_REQUIRED" });
    if (!startDate) return res.status(400).json({ error: "START_DATE_REQUIRED" });
    if (!durationHours || durationHours < 1) return res.status(400).json({ error: "INVALID_DURATION" });
    if (!amount || amount < 50) return res.status(400).json({ error: "INVALID_AMOUNT" });

    const doc = await Booking.create({
      email,
      guideId,
      startDate,
      durationHours,
      amount,
      currency,
      status: "PENDING",
      paidAt: null,
      stripePaymentIntentId: null,
    });

    return res.status(201).json({ ok: true, bookingId: doc._id });
  } catch (e) {
    return res.status(500).json({ error: "BOOKING_CREATE_FAILED", message: e?.message || String(e) });
  }
});

export default router;
