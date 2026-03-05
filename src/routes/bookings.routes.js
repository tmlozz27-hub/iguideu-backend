import express from "express"
import mongoose from "mongoose"

const router = express.Router()

const BookingSchema = new mongoose.Schema(
  {
    travelerName: { type: String, default: "" },
    travelerEmail: { type: String, required: true, index: true },
    guideId: { type: String, required: true, index: true },

    date: { type: String, required: true },
    hours: { type: Number, required: true, min: 0.25 },

    currency: { type: String, default: "usd" },
    price: { type: Number, required: true, min: 0 },
    amountCents: { type: Number, required: true, min: 0 },

    status: { type: String, default: "PENDING", index: true },

    total: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },

    stripePaymentIntentId: { type: String, default: null },
    paidAt: { type: Date, default: null }
  },
  { timestamps: true }
)

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", BookingSchema, "bookings")

function toNumber(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

router.get("/", async (req, res) => {
  try {
    const { travelerEmail, guideId, status, limit } = req.query || {}

    const q = {}
    if (travelerEmail) q.travelerEmail = String(travelerEmail)
    if (guideId) q.guideId = String(guideId)
    if (status) q.status = String(status)

    const lim = Math.min(Math.max(toNumber(limit, 50), 1), 200)

    const items = await Booking.find(q).sort({ createdAt: -1 }).limit(lim).lean()
    return res.status(200).json(items)
  } catch (err) {
    return res.status(500).json({ ok: false, error: "BOOKINGS_FETCH_FAILED", detail: err?.message || "Internal Server Error" })
  }
})

router.post("/", async (req, res) => {
  try {
    const b = req.body || {}

    const travelerName = String(b.travelerName || "")
    const travelerEmail = String(b.travelerEmail || "").trim().toLowerCase()

    const guideId = String(b.guideId || b.guide || "").trim()
    const date = String(b.date || b.startDate || "").trim()

    const hours = toNumber(b.hours ?? b.durationHours ?? b.duration ?? 0, 0)
    const currency = String(b.currency || "usd").trim().toLowerCase()

    const price = toNumber(
      b.price ?? b.total ?? b.totalAmount ?? b.amount ?? 0,
      0
    )

    if (!travelerEmail) return res.status(400).json({ ok: false, error: "travelerEmail is required" })
    if (!guideId) return res.status(400).json({ ok: false, error: "guideId is required" })
    if (!date) return res.status(400).json({ ok: false, error: "date is required (YYYY-MM-DD)" })
    if (!hours || hours <= 0) return res.status(400).json({ ok: false, error: "hours must be > 0" })
    if (price < 0) return res.status(400).json({ ok: false, error: "price must be >= 0" })

    const amountCents = Math.round(price * 100)

    const doc = await Booking.create({
      travelerName,
      travelerEmail,
      guideId,
      date,
      hours,
      currency,
      price,
      amountCents,
      total: price,
      totalAmount: price,
      amount: price,
      status: "PENDING"
    })

    return res.status(201).json(doc)
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "BOOKING_CREATE_FAILED",
      detail: err?.message || "Internal Server Error"
    })
  }
})

router.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim()
    const item = await Booking.findById(id).lean()
    if (!item) return res.status(404).json({ ok: false, error: "Booking not found" })
    return res.status(200).json(item)
  } catch (err) {
    return res.status(500).json({ ok: false, error: "BOOKING_FETCH_FAILED", detail: err?.message || "Internal Server Error" })
  }
})

export default router