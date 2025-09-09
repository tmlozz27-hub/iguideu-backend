import { Router } from 'express';
import Booking from '../models/Booking.js';
import authRequired from '../middlewares/authRequired.js';

const router = Router();

// AUTORIZAR
router.post('/authorize/:id', authRequired, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, traveler: req.user.id });
    if (!booking) return res.status(404).json({ error: 'not_found' });

    if (booking.payment?.status === 'paid') {
      return res.json({ booking }); // ya estaba pago
    }

    booking.payment = booking.payment || {};
    booking.payment.status = 'authorized';
    booking.payment.feePct = 10;
    booking.payment.feeAmount = 0;
    booking.payment.netAmount = 0;
    await booking.save();

    return res.json({ booking });
  } catch (e) {
    console.warn(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

// CAPTURAR
router.post('/capture/:id', authRequired, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, traveler: req.user.id });
    if (!booking) return res.status(404).json({ error: 'not_found' });

    // Podés exigir que esté 'authorized' antes; si no, lo forzamos a 'paid'
    booking.payment = booking.payment || {};
    booking.payment.status = 'paid';

    // calcular fee/net (simple demo)
    const feePct = booking.payment.feePct ?? 10;
    booking.payment.feePct = feePct;
    booking.payment.feeAmount = Math.round((booking.price * feePct) / 100);
    booking.payment.netAmount = booking.price - booking.payment.feeAmount;

    booking.status = 'confirmed';
    await booking.save();

    return res.json({ booking });
  } catch (e) {
    console.warn(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
