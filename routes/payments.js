import express from "express";
import Stripe from "stripe";
import Guide from "../models/Guide.js";
import Booking from "../models/Booking.js";

const router = express.Router();

function must(v, name) {
  if (!v) throw new Error(`${name} missing`);
  return v;
}

function computeTotalUsd(guide, durationType, hours) {
  const hour = guide.priceHourUsd ?? guide.priceHour ?? guide.hourlyRate;
  const day = guide.priceDayUsd ?? guide.priceDay ?? guide.dailyRate;

  if (durationType === "HOURS") {
    const h = Math.max(1, Math.min(7, Number(hours || 1)));
    return { totalUsd: Number(hour) * h, normalized: { durationType: "HOURS", hours: h } };
  }

  if (durationType === "FULL_DAY_8") {
    return { totalUsd: Number(day), normalized: { durationType: "FULL_DAY_8", hours: 8 } };
  }

  if (durationType === "FULL_DAY_24H") {
    // regla simple por ahora: 24h = day + 16h extra (si querés otra, la cambiamos)
    const total = Number(day) + Number(hour) * 16;
    return { totalUsd: total, normalized: { durationType: "FULL_DAY_24H", hours: 24 } };
  }

  throw new Error("Invalid durationType");
}

router.post("/create-checkout", async (req, res) => {
  try {
    const stripeKey = must(process.env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY");
    const stripe = new Stripe(stripeKey);

    const { guideId, durationType, hours, email } = req.body || {};
    if (!guideId) return res.status(400).json({ error: "guideId required" });
    if (!durationType) return res.status(400).json({ error: "durationType required" });
    if (!email) return res.status(400).json({ error: "email required" });

    const guide = await Guide.findById(guideId);
    if (!guide) return res.status(404).json({ error: "Guide not found" });

    const { totalUsd, normalized } = computeTotalUsd(guide, durationType, hours);

    // crear booking en DB
    const booking = await Booking.create({
      guideId: guide._id,
      guideName: guide.name,
      city: guide.city,
      email,
      durationType: normalized.durationType,
      hours: normalized.hours,
      totalUsd,
      paymentStatus: "pending",
    });

    const publicBase = (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4026}`).replace(/\/+$/, "");

    const successUrl = `${publicBase}/return/success?bookingId=${booking._id}`;
    const cancelUrl = `${publicBase}/return/cancel?bookingId=${booking._id}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(Number(totalUsd) * 100),
            product_data: {
              name: `${guide.name} – ${normalized.durationType}`,
              description: `${guide.city || ""}`.trim(),
            },
          },
        },
      ],
      metadata: {
        bookingId: String(booking._id),
        guideId: String(guide._id),
        durationType: String(normalized.durationType),
        hours: String(normalized.hours),
        totalUsd: String(totalUsd),
      },
    });

    return res.json({
      ok: true,
      url: session.url,
      bookingId: booking._id,
      totalUsd,
      durationType: normalized.durationType,
      hours: normalized.hours,
    });
  } catch (err) {
    console.error("❌ create-checkout error:", err?.message || err);
    return res.status(500).json({ error: "create-checkout failed" });
  }
});

export default router;

