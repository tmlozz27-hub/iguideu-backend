import Stripe from "stripe";
import Order from "../models/Order.js";
import getRawBody from "raw-body";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const whsec = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function paymentsWebhook(req, res) {
  try {
    // body crudo ya viene por bodyParser.raw en server.js
    const sig = req.headers["stripe-signature"];
    if (!sig) return res.status(400).send("Missing stripe-signature");

    // Construimos el event verificando firma
    const event = stripe.webhooks.constructEvent(req.body, sig, whsec);

    if (event.type === "payment_intent.created" || event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed" || event.type === "payment_intent.processing" || event.type === "payment_intent.canceled") {
      const pi = event.data.object;
      // upsert de la orden
      await Order.findOneAndUpdate(
        { paymentIntentId: pi.id },
        {
          paymentIntentId: pi.id,
          amount: pi.amount,
          currency: pi.currency,
          status: pi.status,
          metadata: pi.metadata || {},
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`✅ [WEBHOOK] ${event.type} -> ${pi.id}`);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("❌ [WEBHOOK] error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
}

