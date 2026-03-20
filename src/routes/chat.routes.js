import express from "express"
import ChatMessage from "../models/ChatMessage.js"

const router = express.Router()

function toSafeString(value) {
  return String(value || "").trim()
}

function toSafeLimit(value, fallback = 200) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.round(n), 1), 500)
}

router.get("/health", (req, res) => {
  return res.status(200).json({ ok: true })
})

router.get("/messages", async (req, res) => {
  try {
    const bookingId = toSafeString(req.query.bookingId)
    const limit = toSafeLimit(req.query.limit, 200)

    if (!bookingId) {
      return res.status(400).json({
        ok: false,
        error: "bookingId required"
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

router.post("/messages", async (req, res) => {
  try {
    const bookingId = toSafeString(req.body?.bookingId)
    const senderId = toSafeString(req.body?.senderId)
    const senderType = toSafeString(req.body?.senderType)
    const text = toSafeString(req.body?.text)

    if (!bookingId) {
      return res.status(400).json({ ok: false, error: "bookingId required" })
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
      error: error?.message || "CHAT_SEND_ERROR"
    })
  }
})

export default router