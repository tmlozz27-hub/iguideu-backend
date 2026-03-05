router.post("/create-intent", async (req, res) => {
  try {
    const bookingId = String(req.body?.bookingId || "").trim()
    if (!bookingId) return res.status(400).json({ ok: false, error: "BOOKING_ID_REQUIRED" })

    const booking = await Booking.findById(bookingId)
    if (!booking) return res.status(404).json({ ok: false, error: "BOOKING_NOT_FOUND" })

    const currency = String(booking.currency || req.body?.currency || "usd").toLowerCase()

    const amountCents =
      Number(booking.amountCents) ||
      Number(booking.totalCents) ||
      Number(booking.totalAmountCents) ||
      Math.round(Number(booking.totalAmount || booking.total || booking.amount || 0) * 100) ||
      Math.round(Number(booking.price || 0) * Number(booking.hours || 1) * 100)

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({ ok: false, error: "AMOUNT_REQUIRED" })
    }

    const feeCents = Math.round(amountCents * 0.1)

    const pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { bookingId: String(booking._id) },
    })

    booking.stripePaymentIntentId = pi.id
    await booking.save()

    return res.status(200).json({
      ok: true,
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      amountCents,
      currency,
      feeCents,
    })
  } catch (e) {
    return res.status(500).json({ ok: false, error: "CREATE_INTENT_FAILED" })
  }
})