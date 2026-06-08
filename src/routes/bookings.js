import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

// Modelo Booking inline (simple y estable)
const BookingSchema =
  mongoose.models.Booking?.schema ||
  new mongoose.Schema(
    {
      email: { type: String, default: "" },
      guideId: { type: mongoose.Schema.Types.ObjectId, ref: "Guide" },
      guideName: { type: String, default: "" },
      hoursRequested: { type: Number, default: 1 },
      date: { type: String, default: "" },
      status: { type: String, default: "pending" },
      totalUsd: { type: Number, default: 0 },
    },
    { timestamps: true }
  );

const Booking = mongoose.models.Booking || mongoose.model("Booking", BookingSchema);

// GET /api/bookings?email=...
router.get("/", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    const filter = email ? { email } : {};
    const bookings = await Booking.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ ok: true, bookings });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
});

// POST /api/bookings
router.post("/", async (req, res) => {
  try {
    const {
      email = "",
      guideId = "",
      guideName = "",
      hoursRequested = 1,
      date = "",
      totalUsd = 0,
      status = "pending",
    } = req.body || {};

    if (!email) return res.status(400).json({ ok: false, error: "missing_email" });
    if (!guideId) return res.status(400).json({ ok: false, error: "missing_guideId" });

    const booking = await Booking.create({
      email,
      guideId,
      guideName,
      hoursRequested: Number(hoursRequested) || 1,
      date: String(date || ""),
      totalUsd: Number(totalUsd) || 0,
      status: String(status || "pending"),
    });

    res.json({ ok: true, booking });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
});

// DELETE /api/bookings/test?email=...
// - si mandás email => borra solo ese email
// - si NO mandás email => requiere header X-ADMIN-KEY=dev
router.delete("/test", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();

    if (!email) {
      const adminKey = String(req.header("X-ADMIN-KEY") || "");
      if (adminKey !== "dev") {
        return res.status(401).json({ ok: false, error: "unauthorized" });
      }
    }

    const filter = email ? { email } : {};
    const result = await Booking.deleteMany(filter);

    res.json({ ok: true, deleted: result.deletedCount || 0 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
});

export default router;
