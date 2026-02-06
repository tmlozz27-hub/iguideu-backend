import express from "express";
import Stripe from "stripe";

const router = express.Router();

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-06-20" }) : null;

router.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  try {
    if (!stripe) return res.status(500).send("STRIPE_SECRET_KEY_MISSING");
    if (!webhookSecret) return res.status(500).send("STRIPE_WEBHOOK_SECRET_MISSING");

    const sig = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    return res.status(200).send("ok");
  } catch (e) {
    return res.status(400).send(`webhook error: ${e?.message || e}`);
  }
});

export default router;
