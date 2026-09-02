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

async function loadBookingOrNull(bookingId) {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) return null
  const db = mongoose.connection?.db
  if (!db) return null
  return db.collection("bookings").findOne({ _id: new mongoose.Types.ObjectId(bookingId) })
}

async function isBookingParty(booking, currentUserEmail) {
  const u = String(currentUserEmail || "").trim().toLowerCase()
  if (!u) return false

  const traveler = String(booking.travelerEmail || "").trim().toLowerCase()
  if (traveler && traveler === u) return true

  const bookingGuideId = String(booking.guideId || "").trim()
  if (!bookingGuideId) return false

  const db = mongoose.connection?.db
  if (!db) return false

  const guide = await db.collection("guides").findOne({ email: u })
  if (!guide) return false

  if (bookingGuideId === String(guide._id)) return true
  const legacy = guide.guideId != null ? String(guide.guideId).trim() : ""
  if (legacy && bookingGuideId === legacy) return true
  return false
}

function canReadChat(booking) {
  const status = String(booking?.status || "").trim().toUpperCase();
  return status === "PAID" || status === "COMPLETED";
}

function canWriteChat(booking) {
  const status = String(booking?.status || "").trim().toUpperCase();
  return status === "PAID";
}

router.get("/health", (req, res) => {
  return res.status(200).json({ ok: true })
})

router.get("/messages", requireAuth, async (req, res) => {
  try {
    const bookingId = toSafeString(req.query.bookingId)
    const limit = toSafeLimit(req.query.limit, 200)
    const currentUserEmail = authEmail(req)

    if (!currentUserEmail) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED"
      })
    }

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

    const bookingTravelerEmail = String(booking.travelerEmail || "").trim().toLowerCase()

    if (!bookingTravelerEmail) {
      return res.status(400).json({
        ok: false,
        error: "BOOKING_TRAVELER_EMAIL_MISSING"
      })
    }

    if (!(await isBookingParty(booking, currentUserEmail))) {
      return res.status(403).json({
        ok: false,
        error: "FORBIDDEN_BOOKING"
      })
    }

    if (!canReadChat(booking)) {
      return res.status(403).json({
        ok: false,
        error: "CHAT_NOT_AVAILABLE"
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
      error: "CHAT_MESSAGES_ERROR"
    })
  }
})

router.post("/messages", requireAuth, async (req, res) => {
  try {
    const bookingId = toSafeString(req.body?.bookingId)
    const text = toSafeString(req.body?.text)
    const currentUserEmail = authEmail(req)

    if (!currentUserEmail) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" })
    }

    if (!bookingId) {
      return res.status(400).json({ ok: false, error: "bookingId required" })
    }

    const booking = await loadBookingOrNull(bookingId)

    if (!booking) {
      return res.status(404).json({ ok: false, error: "BOOKING_NOT_FOUND" })
    }

    const bookingTravelerEmail = String(booking.travelerEmail || "").trim().toLowerCase()

    if (!bookingTravelerEmail) {
      return res.status(400).json({ ok: false, error: "BOOKING_TRAVELER_EMAIL_MISSING" })
    }

    if (!(await isBookingParty(booking, currentUserEmail))) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN_BOOKING" })
    }

    if (!canWriteChat(booking)) {
      return res.status(403).json({
        ok: false,
        error: "CHAT_NOT_AVAILABLE"
      })
    }

    const senderId = String(req.user?.id || currentUserEmail).trim()
    const senderType =
      currentUserEmail === bookingTravelerEmail ? "traveler" : "guide"

    if (bookingEndPlus48hPassed(booking)) {
      return res.status(403).json({
        ok: false,
        error: "CHAT_CLOSED_AFTER_SERVICE"
      })
    }

    if (!senderId) {
      return res.status(400).json({ ok: false, error: "senderId required" })
    }

    if (!senderType) {
      return res.status(400).json({ ok: false, error: "senderType required" })
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
      senderType,
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
      error: "CHAT_SEND_ERROR"
    })
  }
})

export default router
