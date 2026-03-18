import express from "express"
import ChatMessage from "../models/ChatMessage.js"

const router = express.Router()

router.get("/health", (req, res) => {
  res.status(200).json({ ok: true })
})

router.get("/messages", async (req, res) => {
  try {
    const bookingId = String(req.query.bookingId || "").trim()

    if (!bookingId) {
      return res.status(400).json({
        ok: false,
        error: "bookingId required"
      })
    }

    const rows = await ChatMessage.find({ bookingId })
      .sort({ createdAt: 1 })
      .lean()

    res.status(200).json({
      ok: true,
      items: rows
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error?.message || "CHAT_MESSAGES_ERROR"
    })
  }
})

router.post("/messages", async (req, res) => {
  try {
    const bookingId = String(req.body?.bookingId || "").trim()
    const senderId = String(req.body?.senderId || "").trim()
    const senderType = String(req.body?.senderType || "").trim()
    const text = String(req.body?.text || "").trim()

    if (!bookingId) {
      return res.status(400).json({ ok: false, error: "bookingId required" })
    }

    if (!senderId) {
      return res.status(400).json({ ok: false, error: "senderId required" })
    }

    const created = await ChatMessage.create({
      bookingId,
      senderId,
      senderType,
      text,
      type: "text"
    })

    res.status(201).json({
      ok: true,
      item: created
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error?.message || "CHAT_SEND_ERROR"
    })
  }
})

export default router