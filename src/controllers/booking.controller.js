// src/controllers/booking.controller.js
// Controlador en memoria para pruebas (sin Mongo)

const bookings = new Map(); // _id -> booking

function makeObjectId() {
  // genera un 24-hex pseudo ObjectId
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 24; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

exports.createBooking = async (req, res) => {
  try {
    // Debe venir autenticado como traveler (stub de /middlewares/auth ya lo setea)
    if (!req.user || req.user.role !== 'traveler') {
      return res.status(401).json({ error: 'Solo traveler puede crear booking' });
    }

    const { guideId, startAt, endAt, priceUSD, availabilityBlockId } = req.body || {};
    if (!guideId || !startAt || !endAt || typeof priceUSD !== 'number') {
      return res.status(400).json({ error: 'Faltan campos: guideId, startAt, endAt, priceUSD' });
    }

    const _id = makeObjectId();
    const booking = {
      _id,
      traveler: req.user.id,   // del token TRAVELER:...
      guide: guideId,          // string 24-hex
      startAt,
      endAt,
      priceUSD,
      availabilityBlockId: availabilityBlockId || null,
      status: 'pending',       // pending | confirmed | cancelled
      createdAt: new Date().toISOString(),
      cancelledAt: null,
    };

    bookings.set(_id, booking);
    return res.status(201).json({ booking });
  } catch (err) {
    console.warn('createBooking error:', err);
    return res.status(500).json({ error: 'createBooking failed (in-memory)' });
  }
};

exports.confirmBooking = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'guide') {
      return res.status(401).json({ error: 'Solo guía puede confirmar' });
    }
    const { id } = req.params;
    const booking = bookings.get(id);
    if (!booking) return res.status(404).json({ error: 'Booking no encontrado' });

    // Solo el dueño (guía) de la reserva
    if (booking.guide !== req.user.id) {
      return res.status(403).json({ error: 'No sos el guía de este booking' });
    }

    if (booking.status !== 'pending') {
      return res.status(409).json({ error: `No se puede confirmar desde estado ${booking.status}` });
    }

    booking.status = 'confirmed';
    return res.json({ booking });
  } catch (err) {
    console.warn('confirmBooking error:', err);
    return res.status(500).json({ error: 'confirmBooking failed (in-memory)' });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });

    const { id } = req.params;
    const booking = bookings.get(id);
    if (!booking) return res.status(404).json({ error: 'Booking no encontrado' });

    const isGuide = req.user.role === 'guide' && booking.guide === req.user.id;
    const isTraveler = req.user.role === 'traveler' && booking.traveler === req.user.id;

    if (!isGuide && !isTraveler) {
      return res.status(403).json({ error: 'No sos parte de este booking' });
    }

    // Reglas:
    // - Guía puede cancelar si está pending o confirmed.
    // - Viajero puede cancelar solo si está pending (no confirmed).
    if (isGuide) {
      if (booking.status === 'cancelled') {
        return res.status(409).json({ error: 'Ya está cancelado' });
      }
      booking.status = 'cancelled';
      booking.cancelledAt = new Date().toISOString();
      return res.json({ booking });
    }

    if (isTraveler) {
      if (booking.status === 'confirmed') {
        return res.status(409).json({ error: 'El viajero no puede cancelar un confirmed' });
      }
      if (booking.status === 'cancelled') {
        return res.status(409).json({ error: 'Ya está cancelado' });
      }
      // pending -> puede cancelar
      booking.status = 'cancelled';
      booking.cancelledAt = new Date().toISOString();
      return res.json({ booking });
    }

    return res.status(400).json({ error: 'Regla no contemplada' });
  } catch (err) {
    console.warn('cancelBooking error:', err);
    return res.status(500).json({ error: 'cancelBooking failed (in-memory)' });
  }
};
