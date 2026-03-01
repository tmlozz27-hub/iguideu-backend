import express from "express";
import Booking from "../models/Booking.js";

const router = express.Router();

function toNumber(x) {
  if (x === null || x === undefined) return null;
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const v = Number(x.replace(",", "."));
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

router.get("/", async (req, res) => {
  try {
    const travelerEmail = (req.query.travelerEmail || "").toString().trim();
    const q = travelerEmail ? { travelerEmail } : {};
    const items = await Booking.find(q).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ ok: true, items, count: items.length });
  } catch {
    return res.status(500).json({ ok: false, error: "BOOKINGS_GET_FAILED" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = (req.params?.id || "").toString();
    if (!id) return res.status(400).json({ ok: false, error: "BOOKING_ID_REQUIRED" });

    const booking = await Booking.findById(id).lean();
    if (!booking) return res.status(404).json({ ok: false, error: "BOOKING_NOT_FOUND" });

    return res.status(200).json({ ok: true, item: booking, booking });
  } catch {
    return res.status(500).json({ ok: false, error: "BOOKING_GET_FAILED" });
  }
});

router.post("/", async (req, res) => {
  try {
    const travelerEmail = (req.body?.travelerEmail || "").toString().trim();
    if (!travelerEmail) return res.status(400).json({ ok: false, error: "TRAVELER_EMAIL_REQUIRED" });

    const guideId = (req.body?.guideId || req.body?.guideID || req.body?.guide_id || "").toString();
    const guideName = (req.body?.guideName || req.body?.guideTitle || req.body?.guide || "").toString();
    const city = (req.body?.city || "").toString();
    const country = (req.body?.country || req.body?.guideCountry || "").toString();

    const duration = (req.body?.duration || "HOURS").toString().toUpperCase();

    const hours =
      toNumber(req.body?.hours) ??
      toNumber(req.body?.hoursRequested) ??
      toNumber(req.body?.durationHours) ??
      toNumber(req.body?.hours_requested) ??
      0;

    const rate =
      toNumber(req.body?.rate) ??
      toNumber(req.body?.rateUsd) ??
      toNumber(req.body?.rateUSD) ??
      toNumber(req.body?.ratePerHour) ??
      toNumber(req.body?.pricePerHour) ??
      null;

    let total =
      toNumber(req.body?.total) ??
      toNumber(req.body?.amountUSD) ??
      toNumber(req.body?.amountUsd) ??
      toNumber(req.body?.totalAmount) ??
      toNumber(req.body?.amount) ??
      0;

    if ((!total || total <= 0) && hours > 0 && rate && rate > 0) {
      total = Math.round(hours * rate * 100) / 100;
    }

    const currency = (req.body?.currency || "USD").toString().toUpperCase();
    const status = (req.body?.status || "PENDING").toString().toUpperCase();

    const doc = await Booking.create({
      travelerEmail,
      guideId,
      guideName,
      city,
      country,
      duration,
      hours,
      total,
      currency,
      status,
      source: (req.body?.source || "").toString(),
    });

    const booking = doc.toObject ? doc.toObject() : doc;

    return res.status(201).json({ ok: true, item: booking, booking });
  } catch {
    return res.status(500).json({ ok: false, error: "BOOKING_CREATE_FAILED" });
  }
});

router.patch("/:id/mark-paid", async (req, res) => {
  try {
    const key = (req.headers["x-internal-key"] || "").toString();
    const expected = (process.env.INTERNAL_WEBHOOK_KEY || "").toString();
    if (!expected || key !== expected) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const id = (req.params?.id || "").toString();
    if (!id) return res.status(400).json({ ok: false, error: "BOOKING_ID_REQUIRED" });

    const paymentIntentId = (req.body?.paymentIntentId || "").toString();
    const status = (req.body?.status || "PAID").toString().toUpperCase();

    const updated = await Booking.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          stripePaymentIntentId: paymentIntentId || undefined,
          paidAt: new Date().toISOString(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ ok: false, error: "BOOKING_NOT_FOUND" });

    return res.status(200).json({ ok: true, item: updated, booking: updated });
  } catch {
    return res.status(500).json({ ok: false, error: "BOOKING_MARK_PAID_FAILED" });
  }
});

export default router;