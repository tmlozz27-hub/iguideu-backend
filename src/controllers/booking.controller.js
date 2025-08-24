// src/controllers/booking.controller.js
const Booking = require('../models/Booking');
const Availability = require('../models/Availability');
const GuideProfile = require('../models/GuideProfile');

const COMMISSION_PCT = Number(process.env.BOOKING_COMMISSION_PCT || 10);

/**
 * Crea una reserva (pending) si cae dentro de un bloque de disponibilidad del guía.
 * body: { guideId, startAt, endAt, priceUSD }
 */
exports.createBooking = async (req, res) => {
  try {
    const travelerId = req.user.id;
    const { guideId, startAt, endAt, priceUSD } = req.body;

    if (!guideId || !startAt || !endAt || !priceUSD) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    if (guideId === travelerId) {
      return res.status(400).json({ error: 'El viajero no puede reservarse a sí mismo' });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (!(start < end)) {
      return res.status(400).json({ error: 'Rango inválido' });
    }

    // Debe caer dentro de una disponibilidad del guía
    const block = await Availability.findOne({
      guideUserId: guideId,
      startAt: { $lte: start },
      endAt: { $gte: end },
    });

    if (!block) {
      return res.status(400).json({ error: 'El rango no cae dentro de una disponibilidad del guía' });
    }

    // Evitar solape con otras reservas del guía (pending/confirmed)
    const overlap = await Booking.findOne({
      guide: guideId,
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        { startAt: { $lt: end }, endAt: { $gt: start } }, // solape estricto
      ],
    });

    if (overlap) {
      return res.status(409).json({ error: 'El guía ya tiene una reserva en ese horario' });
    }

    const booking = await Booking.create({
      traveler: travelerId,
      guide: guideId,
      startAt: start,
      endAt: end,
      priceUSD: Number(priceUSD),
      commissionPct: COMMISSION_PCT,
      status: 'pending',
    });

    return res.json({ booking });
  } catch (err) {
    console.error('createBooking error:', err);
    return res.status(500).json({ error: 'No se pudo crear la reserva' });
  }
};

/**
 * Mis reservas (del usuario autenticado)
 */
exports.myBookings = async (req, res) => {
  try {
    const userId = req.user.id;

    const bookings = await Booking.find({
      $or: [{ traveler: userId }, { guide: userId }],
    }).sort({ createdAt: -1 });

    return res.json({ bookings });
  } catch (err) {
    console.error('myBookings error:', err);
    return res.status(500).json({ error: 'No se pudieron obtener las reservas' });
  }
};

/**
 * Confirmar (solo guía dueño de la reserva)
 * params: { id }
 */
exports.confirmBooking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

    if (String(booking.guide) !== String(userId)) {
      return res.status(403).json({ error: 'No sos el guía dueño de la reserva' });
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Solo se pueden confirmar reservas en estado pending' });
    }

    booking.status = 'confirmed';
    await booking.save();

    return res.json({ booking });
  } catch (err) {
    console.error('confirmBooking error:', err);
    return res.status(500).json({ error: 'No se pudo confirmar la reserva' });
  }
};

/**
 * Cancelar reserva.
 * - Viajero: solo puede cancelar si está PENDING.
 * - Guía: puede cancelar si está PENDING o CONFIRMED.
 * params: { id }
 */
exports.cancelBooking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

    const isTraveler = String(booking.traveler) === String(userId);
    const isGuide = String(booking.guide) === String(userId);

    if (!isTraveler && !isGuide) {
      return res.status(403).json({ error: 'No sos parte de esta reserva' });
    }

    // Reglas
    if (isTraveler) {
      // viajero: solo pending
      if (booking.status !== 'pending') {
        return res.status(400).json({ error: 'El viajero no puede cancelar una reserva ya confirmada' });
      }
    } else if (isGuide) {
      // guía: pending o confirmed
      if (!['pending', 'confirmed'].includes(booking.status)) {
        return res.status(400).json({ error: 'El guía solo puede cancelar reservas pending o confirmed' });
      }
    }

    booking.status = 'cancelled';
    await booking.save();

    return res.json({ booking });
  } catch (err) {
    console.error('cancelBooking error:', err);
    return res.status(500).json({ error: 'No se pudo cancelar la reserva' });
  }
};
