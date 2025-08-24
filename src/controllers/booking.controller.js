// dentro de src/controllers/booking.controller.js
const Booking = require('../models/Booking');
const Availability = require('../models/Availability');

exports.cancelBooking = async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { id } = req.params;
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

    const isTraveler = booking.traveler?.toString() === userId;
    const isGuide    = booking.guide?.toString() === userId;

    // Reglas:
    // - viajero: solo puede cancelar si está PENDING
    // - guía: puede cancelar si está PENDING o CONFIRMED
    if (isTraveler) {
      if (booking.status !== 'pending') {
        return res.status(400).json({ error: 'El viajero no puede cancelar una reserva ya confirmada' });
      }
    } else if (isGuide) {
      if (!['pending','confirmed'].includes(booking.status)) {
        return res.status(400).json({ error: 'La reserva no está en estado cancelable' });
      }
    } else {
      return res.status(403).json({ error: 'No autorizado' });
    }

    booking.status = 'cancelled';
    await booking.save();
    return res.json({ booking });
  } catch (err) {
    console.error('cancelBooking error', err);
    return res.status(500).json({ error: 'No se pudo cancelar la reserva' });
  }
};
