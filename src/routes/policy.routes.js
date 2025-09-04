import { Router } from "express";
import Booking from "../models/Booking.js";

const router = Router();

router.get("/cancellation", async (req, res) => {
  const { bookingId } = req.query;
  const b = await Booking.findById(bookingId);
  if (!b) return res.status(404).json({ error: "Booking not found" });

  const now = new Date();
  const start = new Date(b.startAt);
  const hours = (start - now) / 36e5;

  let refundPct = 0;
  let reason = "Late cancellation (<24h)";
  if (hours >= 48) {
    refundPct = 100;
    reason = "Full refund (>=48h)";
  } else if (hours >= 24) {
    refundPct = 50;
    reason = "Partial refund (24–48h)";
  }

  res.json({ bookingId: b._id, refundPct, reason, hoursToStart: Math.floor(hours) });
});

export default router;
