import express from "express";
import Stripe from "stripe";
import { getModels } from "../services/mongo.js";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-08-27.basil",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

router.post("/webhook", async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    if (!sig) return res.status(400).send("webhook error: missing stripe-signature");
    if (!webhookSecret) return res.status(500).send("STRIPE_WEBHOOK_SECRET_MISSING");

    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    const { Booking, Payment } = getModels();

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;

      const paymentIntentId = pi.id || "";
      const amount = Number(pi.amount_received ?? pi.amount ?? 0);
      const currency = (pi.currency || "usd").toLowerCase();

      const platformFeePercent = 10;
      const platformFeeAmount = Math.round((amount * platformFeePercent) / 100);
      const guideNetAmount = Math.max(0, amount - platformFeeAmount);

      const payment = await Payment.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntentId },
        {
          $set: {
            status: "paid",
            amount,
            currency,
            platformFeePercent,
            platformFeeAmount,
            guideNetAmount,
            lastEventId: event.id,
          },
        },
        { new: true }
      );

      if (payment && payment.bookingId) {
        await Booking.findByIdAndUpdate(payment.bookingId, {
          $set: {
            status: "confirmed",
            paymentStatus: "paid",
            stripePaymentIntentId: paymentIntentId,
          },
        });
      } else {
        await Booking.updateMany(
          { stripePaymentIntentId: paymentIntentId },
          { $set: { status: "confirmed", paymentStatus: "paid" } }
        );
      }

      console.log("[WEBHOOK] payment_intent.succeeded -> paid", paymentIntentId);
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    return res.status(400).send(`webhook error: ${e?.message || e}`);
  }
});

export default router;