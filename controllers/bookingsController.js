// controllers/bookingsController.js
// Controlador de reservas para I GUIDE U

import Stripe from 'stripe';
import Booking from '../models/Booking.js';
import { calculateExtensionTo24h } from '../utils/pricing.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Extiende una reserva de 8 hs (DAY) a 24 hs
 * Cobrando solo la diferencia entre lo ya pagado y pricePer24h.
 *
 * POST /api/bookings/:id/extend-to-24h
 */
export const extendBookingTo24h = async (req, res) => {
  try {
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ ok: false, error: 'Booking no encontrado' });
    }

    // Calculamos diferencia y nuevo total
    const calc = calculateExtensionTo24h(booking);

    if (calc.extraToPay <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'No se requiere pago extra para esta extensión.'
      });
    }

    // Creamos pago en Stripe SOLO por la diferencia
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(calc.extraToPay * 100),
            product_data: {
              name: `Extensión de reserva I GUIDE U (${calc.fromHours}h → 24h)`
            }
          },
          quantity: 1
        }
      ],
      success_url: `${process.env.PUBLIC_BASE_URL}/payment-success?bookingId=${booking.id}`,
      cancel_url: `${process.env.PUBLIC_BASE_URL}/payment-cancel?bookingId=${booking.id}`,
      metadata: {
        type: 'booking_extension_24h',
        bookingId: booking.id.toString(),
        fromHours: String(calc.fromHours),
        toHours: String(calc.toHours)
      }
    });

    // Registramos la extensión como "pending"
    booking.extensions.push({
      fromHours: calc.fromHours,
      toHours: calc.toHours,
      extraHours: calc.extraHours,
      extraAmountUsd: calc.extraToPay,
      newDurationType: calc.newDurationType,
      stripeCheckoutSessionId: session.id,
      paymentStatus: 'pending'
    });

    // Actualizamos el total de la reserva
    booking.currentTotalUsd = calc.newTotal;

    await booking.save();

    return res.json({
      ok: true,
      checkoutUrl: session.url,
      extraToPay: calc.extraToPay,
      newTotal: calc.newTotal
    });

  } catch (err) {
    console.error('Error extendBookingTo24h:', err);
    return res.status(500).json({
      ok: false,
      error: 'Error interno al extender la reserva'
    });
  }
};
