import Stripe from "stripe";
import Order from "../models/order.model.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
});

const ENDPOINT_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export async function stripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  if (!ENDPOINT_SECRET) {
    console.error("⚠️ STRIPE_WEBHOOK_SECRET no configurado");
    return res.status(500).send("Webhook no configurado");
  }

  let event;
  try {
    // req.body es RAW gracias a express.raw() en la ruta
    event = stripe.webhooks.constructEvent(req.body, sig, ENDPOINT_SECRET);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        await Order.findOneAndUpdate(
          { paymentIntentId: pi.id },
          { status: "succeeded" },
          { new: true }
        );
        break;
      }
      case "payment_intent.processing": {
        const pi = event.data.object;
        await Order.findOneAndUpdate(
          { paymentIntentId: pi.id },
          { status: "processing" },
          { new: true }
        );
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        await Order.findOneAndUpdate(
          { paymentIntentId: pi.id },
          { status: "failed" },
          { new: true }
        );
        break;
      }
      case "payment_intent.canceled": {
        const pi = event.data.object;
        await Order.findOneAndUpdate(
          { paymentIntentId: pi.id },
          { status: "canceled" },
          { new: true }
        );
        break;
      }
      default:
        // Otros eventos si querés loguearlos
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error("❌ Error procesando webhook:", err);
    res.status(500).send("Error interno");
  }
}

