import express from "express"
import mongoose from "mongoose"
import { requireAuth } from "../middleware/auth.js"
import Stripe from "stripe"
const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
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

    paidAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null }
  },
  { timestamps: true }
)

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", BookingSchema, "bookings")

function toNumber(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function authEmail(req) {
  return String(req.user?.email || "").trim().toLowerCase()
}

function bookingEndPlus48hPassed(booking) {
  const dateStr = String(booking?.date || "").trim()
  const hours = Number(booking?.hours || 0)

  if (!dateStr) return false

  const start = new Date(`${dateStr}T00:00:00.000Z`)
  if (Number.isNaN(start.getTime())) return false

  const endMs = start.getTime() + Math.max(hours, 0) * 60 * 60 * 1000
  const closeMs = endMs + 48 * 60 * 60 * 1000

  return Date.now() >= closeMs
}

async function markCompletedPaidBookings() {
  const paidBookings = await Booking.find({
    status: "PAID",
    date: { $nin: [null, ""] }
  }).limit(500)

  const ids = paidBookings
    .filter((booking) => bookingEndPlus48hPassed(booking))
    .map((booking) => booking._id)

  if (!ids.length) {
    return { updated: 0 }
  }

  const result = await Booking.updateMany(
    { _id: { $in: ids }, status: "PAID" },
    {
      $set: {
        status: "COMPLETED",
        completedAt: new Date()
      }
    }
  )

  return { updated: result.modifiedCount || 0 }
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const { status, limit } = req.query || {}
    const email = authEmail(req)

    await markCompletedPaidBookings()

    if (!email) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED"
      })
    }

    const q = { travelerEmail: email }

    if (status) q.status = String(status)

    const lim = Math.min(Math.max(toNumber(limit, 50), 1), 200)
    const items = await Booking.find(q).sort({ createdAt: -1 }).limit(lim).lean()

    return res.status(200).json(items)
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "BOOKINGS_FETCH_FAILED",
      detail: err?.message || "Internal Server Error"
    })
  }
})

router.get("/guide/me", requireAuth, async (req, res) => {
  try {
    const email = authEmail(req)

    await markCompletedPaidBookings()

    if (!email) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED"
      })
    }

    const db = mongoose.connection?.db

    if (!db) {
      return res.status(500).json({
        ok: false,
        error: "Mongo not connected"
      })
    }

    const guide = await db.collection("guides").findOne({ email })

    if (!guide) {
      return res.status(404).json({
        ok: false,
        error: "GUIDE_NOT_FOUND"
      })
    }

    const guideIds = new Set()
    guideIds.add(String(guide._id))
    const legacyGuideId = guide.guideId != null ? String(guide.guideId).trim() : ""
    if (legacyGuideId) {
      guideIds.add(legacyGuideId)
    }

    const normalizedGuideEmail = String(guide.email || email || "")
      .trim()
      .toLowerCase()

    const guideMatchOr = [{ guideId: { $in: [...guideIds] } }]

    if (normalizedGuideEmail) {
      const escaped = normalizedGuideEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const emailRegex = new RegExp(`^${escaped}$`, "i")
      guideMatchOr.push({ guideEmail: emailRegex })
      guideMatchOr.push({ email: emailRegex })
    }

    const rawStatus = req.query?.status
    const statusStr = rawStatus === undefined || rawStatus === null ? "" : String(rawStatus).trim()

    const upper = statusStr === "" ? "PAID" : statusStr.toUpperCase()

    let q
    if (statusStr === "" || upper !== "ALL") {
      const statusVal = statusStr === "" ? "PAID" : upper
      q = {
        $and: [{ $or: guideMatchOr }, { status: statusVal }]
      }
    } else {
      q = { $or: guideMatchOr }
    }

    const lim = Math.min(Math.max(toNumber(req.query?.limit, 50), 1), 200)
    const rows = await Booking.find(q).sort({ createdAt: -1 }).limit(lim).lean()

    const items = rows.map((b) => {
      const idStr = String(b._id)
      return { ...b, _id: idStr, bookingId: idStr }
    })

    return res.status(200).json({
      ok: true,
      items
    })
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "BOOKINGS_GUIDE_FETCH_FAILED",
      detail: err?.message || "Internal Server Error"
    })
  }
})

router.post("/", requireAuth, async (req, res) => {
  try {
    const b = req.body || {}
    const travelerName = String(b.travelerName || "")
    const travelerEmail = authEmail(req)
    const guideId = String(b.guideId || b.guide || "").trim()
    const date = String(b.date || b.startDate || "").trim()
    const hours = toNumber(b.hours ?? b.durationHours ?? b.duration ?? 0, 0)
    const currency = String(b.currency || "usd").trim().toLowerCase()
    const price = toNumber(
      b.price ?? b.total ?? b.totalAmount ?? b.amount ?? 0,
      0
    )

    if (!travelerEmail) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" })
    }
    if (!guideId) {
      return res.status(400).json({ ok: false, error: "guideId is required" })
    }
    if (!date) {
      return res.status(400).json({ ok: false, error: "date is required (YYYY-MM-DD)" })
    }
    if (!hours || hours <= 0) {
      return res.status(400).json({ ok: false, error: "hours must be > 0" })
    }
    if (price < 0) {
      return res.status(400).json({ ok: false, error: "price must be >= 0" })
    }

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

router.post("/:id/cancel", requireAuth, async (req, res) => {
  try {
    const id = String(req.params?.id || "").trim()
    const email = authEmail(req)

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ ok: false, error: "BOOKING_NOT_FOUND" })
    }

    const booking = await Booking.findById(id)

    if (!booking) {
      return res.status(404).json({ ok: false, error: "BOOKING_NOT_FOUND" })
    }

    const bookingTravelerEmail = String(booking.travelerEmail || "").trim().toLowerCase()

    if (bookingTravelerEmail !== email) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN_BOOKING" })
    }

    if (booking.status === "CANCELLED") {
      return res.status(400).json({ ok: false, error: "BOOKING_ALREADY_CANCELLED" })
    }

   if (booking.stripePaymentIntentId) {
  const refund = await stripe.refunds.create({
    payment_intent: booking.stripePaymentIntentId,
  })

  console.log("STRIPE REFUND OK", refund.id)
}

booking.status = "CANCELLED"
booking.cancelledAt = new Date()

await booking.save()

    return res.status(200).json({ ok: true, booking })
  } catch (err) {
    return res.status(500).json({ ok: false, error: "BOOKING_CANCEL_FAILED", detail: err?.message || "Internal Server Error" })
  }
})

router.get("/:id", requireAuth, async (_req, res) => {
  return res.status(403).json({
    ok: false,
    error: "BOOKING_DIRECT_FETCH_DISABLED"
  })
})

export default router