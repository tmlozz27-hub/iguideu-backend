import express from "express"
import Stripe from "stripe"
import Booking from "../models/Booking.js"

const router = express.Router()

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ""
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ""

const stripe = new Stripe(STRIPE_SECRET_KEY)

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let type = ""
  let piId = ""
  let metaBookingId = ""

  try {
    if (!STRIPE_WEBHOOK_SECRET) return res.status(500).send("webhook_secret_missing")

    const sig = req.headers["stripe-signature"]
    if (!sig) return res.status(400).send("missing_signature")

    const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET)

    type = event.type || ""
    const obj = event.data?.object || {}
    piId = obj.id ? String(obj.id) : ""
    metaBookingId = obj.metadata && obj.metadata.bookingId ? String(obj.metadata.bookingId) : ""

    console.log(new Date().toISOString(), "WEBHOOK type=", type, "pi=", piId, "bookingId=", metaBookingId)

    if (type === "payment_intent.succeeded") {
      let booking = null

      if (metaBookingId) booking = await Booking.findById(metaBookingId)
      if (!booking && piId) booking = await Booking.findOne({ stripePaymentIntentId: piId })

      if (!booking) {
        console.log(new Date().toISOString(), "WEBHOOK no booking matched", { piId, metaBookingId })
        return res.status(200).json({ ok: true, matched: false })
      }

      booking.status = "PAID"
      booking.paidAt = new Date()
      if (piId) booking.stripePaymentIntentId = piId
      await booking.save()

      console.log(new Date().toISOString(), "WEBHOOK booking updated -> PAID", String(booking._id))
      return res.status(200).json({ ok: true, matched: true, bookingId: String(booking._id) })
    }

    return res.status(200).json({ ok: true, ignored: true })
  } catch (e) {
    console.log(new Date().toISOString(), "WEBHOOK_ERROR", { type, piId, metaBookingId, msg: String(e?.message || e) })
    return res.status(500).send("webhook_error")
  }
})

export default router