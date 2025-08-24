const Stripe = require('stripe');
const Booking = require('../models/Booking');

const stripe = new Stripe(process.env.STRIPE_SECRET);

exports.createIntent = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'Falta bookingId' });

    const b = await Booking.findById(bookingId);
    if (!b) return res.status(404).json({ error: 'Reserva no encontrada' });

    if (String(b.traveler) !== req.userId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const amount = Math.round(b.priceUSD * 100);
    const currency = (process.env.CURRENCY || 'usd').toLowerCase();

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        bookingId: b._id.toString(),
        traveler: b.traveler.toString(),
        guide: b.guide.toString(),
        commissionPct: b.commissionPct.toString(),
      },
      automatic_payment_methods: { enabled: true },
    });

    b.stripePaymentId = paymentIntent.id;
    await b.save();

    res.status(201).json({
      clientSecret: paymentIntent.client_secret,
      paymentId: paymentIntent.id,
      amount,
      currency,
    });
  } catch (err) {
    console.error('createIntent error:', err);
    res.status(500).json({ error: 'Error creando intento de pago' });
  }
};
