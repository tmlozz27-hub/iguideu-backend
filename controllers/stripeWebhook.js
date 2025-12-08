// controllers/stripeWebhook.js
// Webhook de Stripe para I GUIDE U

import Stripe from 'stripe';
import Booking from '../models/Booking.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Webhook que recibe eventos de Stripe.
 * Maneja: checkout.session.completed
 */
export const stripeWebhookHandler = async (req, res) => {
  let event;

  try {
    const sig = req.headers['stripe-signature'];

    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

  } catch (err) {
    console.error('❌ Error verificando webhook Stripe:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // Check si es extensión 8 → 24 hs
        if (session.metadata && session.metadata.type === 'booking_extension_24h') {
          const bookingId = session.metadata.bookingId;

          const booking = await Booking.findById(bookingId);
          if (!booking) break;

          // Buscamos la extensión pendiente correspondiente a este checkout
          const ext = booking.extensions.find(
            (e) => e.stripeCheckoutSessionId === session.id
          );

          if (ext) {
            ext.paymentStatus = 'paid';
            await booking.save();
          }

          console.log(
            `✔️ Extensión de reserva ${bookingId} pagada: ${ext?.extraAmountUsd} USD`
          );
        }

        break;
      }

      default:
        console.log(`🔔 Evento Stripe no manejado: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('❌ Error en webhook Stripe:', error);
    res.status(500).send('Error manejando webhook');
  }
};
