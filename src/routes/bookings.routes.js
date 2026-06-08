import express from "express";
import mongoose from "mongoose";

const router = express.Router();

// Booking model inline (no depende de src/models)
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

    const bookings = await Booking.find(filter)
      .populate("guideId", "name fullName city country rating")
      .sort({ createdAt: -1 })
      .limit(200);

    res.json({ ok: true, bookings });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
});

// POST /api/bookings
router.post("/", async (req, res) => {
  try {
    const b = req.body || {};
    const email = String(b.email || "").trim();
    const guideId = String(b.guideId || "").trim();

    const hoursRequested = Number(b.hoursRequested || 1);
    const date = String(b.date || "").trim();
    const totalUsd = Number(b.totalUsd || 0);

    if (!email) return res.status(400).json({ ok: false, error: "email_required" });
    if (!guideId) return res.status(400).json({ ok: false, error: "guideId_required" });
    if (!date) return res.status(400).json({ ok: false, error: "date_required" });

    const booking = await Booking.create({
      email,
      guideId,
      guideName: String(b.guideName || ""),
      hoursRequested,
      date,
      status: String(b.status || "pending"),
      totalUsd,
    });

    res.json({ ok: true, booking });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
});

// DELETE /api/bookings/test?email=...
router.delete("/test", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();

    if (!email) {
      const adminKey = String(req.header("X-ADMIN-KEY") || "").trim();
      if (adminKey !== "dev") {
        return res.status(401).json({ ok: false, error: "admin_key_required" });
      }
    }

    const filter = email ? { email } : {};
    const r = await Booking.deleteMany(filter);

    res.json({ ok: true, deleted: r.deletedCount || 0 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "server_error" });
  }
});

export default router;
