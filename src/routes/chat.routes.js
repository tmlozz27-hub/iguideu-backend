import express from "express"
import mongoose from "mongoose"
import ChatMessage from "../models/ChatMessage.js"
import { requireAuth } from "../middleware/auth.js"

const router = express.Router()

function toSafeString(value) {
  return String(value || "").trim()
}

function toSafeLimit(value, fallback = 200) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.round(n), 1), 500)
}

function authEmail(req) {
  return String(req.user?.email || "").trim().toLowerCase()
}

async function loadBookingOrNull(bookingId) {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) return null
  const db = mongoose.connection?.db
  if (!db) return null
  return db.collection("bookings").findOne({ _id: new mongoose.Types.ObjectId(bookingId) })
}

async function loadGuideByBookingGuideId(guideId) {
  const rawGuideId = toSafeString(guideId)
  if (!rawGuideId) return null

  const db = mongoose.connection?.db
  if (!db) return null

  const guides = db.collection("guides")

  if (mongoose.Types.ObjectId.isValid(rawGuideId)) {
    const byObjectId = await guides.findOne({ _id: new mongoose.Types.ObjectId(rawGuideId) })
    if (byObjectId) return byObjectId
  }

  return guides.findOne({ guideId: rawGuideId })
}

async function resolveChatActor(req, booking) {
  const currentUserEmail = authEmail(req)
  if (!currentUserEmail) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" }
  }

  const bookingTravelerEmail = String(booking?.travelerEmail || "").trim().toLowerCase()
  if (!bookingTravelerEmail) {
    return { ok: false, status: 400, error: "BOOKING_TRAVELER_EMAIL_MISSING" }
  }

  if (bookingTravelerEmail === currentUserEmail) {
    return { ok: true, actorType: "traveler", currentUserEmail }
  }

  const guide = await loadGuideByBookingGuideId(booking?.guideId)
  const bookingGuideEmail = String(guide?.email || "").trim().toLowerCase()

  if (bookingGuideEmail && bookingGuideEmail === currentUserEmail) {
    return { ok: true, actorType: "guide", currentUserEmail }
  }

  return { ok: false, status: 403, error: "FORBIDDEN_BOOKING" }
}

router.get("/health", (req, res) => {
  return res.status(200).json({ ok: true })
})

router.get("/messages", requireAuth, async (req, res) => {
  try {
    const bookingId = toSafeString(req.query.bookingId)
    const limit = toSafeLimit(req.query.limit, 200)

    if (!bookingId) {
      return res.status(400).json({
        ok: false,
        error: "bookingId required"
      })
    }

    const booking = await loadBookingOrNull(bookingId)

    if (!booking) {
      return res.status(404).json({
        ok: false,
        error: "BOOKING_NOT_FOUND"
      })
    }

    const actor = await resolveChatActor(req, booking)
    if (!actor.ok) {
      return res.status(actor.status).json({
        ok: false,
        error: actor.error
      })
    }

    const rows = await ChatMessage.find({ bookingId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean()

    return res.status(200).json({
      ok: true,
      items: rows
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "CHAT_MESSAGES_ERROR"
    })
  }
})

router.post("/messages", requireAuth, async (req, res) => {
  try {
    const bookingId = toSafeString(req.body?.bookingId)
    const senderId = toSafeString(req.body?.senderId)
    const text = toSafeString(req.body?.text)

    if (!bookingId) {
      return res.status(400).json({ ok: false, error: "bookingId required" })
    }

    const booking = await loadBookingOrNull(bookingId)

    if (!booking) {
      return res.status(404).json({ ok: false, error: "BOOKING_NOT_FOUND" })
    }

    const actor = await resolveChatActor(req, booking)
    if (!actor.ok) {
      return res.status(actor.status).json({ ok: false, error: actor.error })
    }

    if (!senderId) {
      return res.status(400).json({ ok: false, error: "senderId required" })
    }

    if (!text) {
      return res.status(400).json({ ok: false, error: "text required" })
    }

    if (text.length > 2000) {
      return res.status(400).json({ ok: false, error: "text too long" })
    }

    const created = await ChatMessage.create({
      bookingId,
      senderId,
      senderType: actor.actorType,
      text,
      type: "text"
    })

    return res.status(201).json({
      ok: true,
      item: created
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "CHAT_SEND_ERROR"
    })
  }
})

export default router