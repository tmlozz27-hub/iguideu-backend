// src/controllers/booking.controller.js
const Booking = require('../models/Booking');
const Availability = require('../models/Availability');
const GuideProfile = require('../models/GuideProfile');

/**
 * Crear una reserva (viajero)
 * Reglas:
 * - Debe existir disponibilidad del guía que cubra totalmente el rango.
 * - status inicial: "pending"
 */
exports.create = async (req, res) => {
  try {
    const { guideId, startAt, endAt, priceUSD } = req.body;

    if (!guideId || !startAt || !endAt || !priceUSD) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // El traveler es el user autenticado
    const travelerId = req.userId;

    // Debe existir un GuideProfile activo de ese guideId (userId del guía)
    const gp = await GuideProfile.findOne({ userId: guideId, isActive: true });
    if (!gp) {
      return res.status(400).json({ error: 'Guía no disponible' });
    }

    // Verificar que el rango esté completamente cubierto por una disponibilidad
    const start = new Date(startAt);
    const end = new Date(endAt);

    if (!(start instanceof Date) || isNaN(start) || !(end instanceof Date) || isNaN(end) || end <= start) {
      return res.status(400).json({ error: 'Rango de fechas inválido' });
    }

    const block = await Availability.findOne({
      guideUserId: guideId,
      startAt: { $lte: start },
      endAt: { $gte: end },
    });

    if (!block) {
      return res.status(400).json({ error: 'El rango no cae dentro de una disponibilidad del guía' });
    }

    const commissionPct = Number(process.env.BOOKING_COMMISSION_PCT || 10);

    const booking = await Booking.create({
      traveler: travelerId,
      guide: guideId,
      startAt: start,
      endAt: end,
      priceUSD,
      commissionPct,
      status: 'pending',
    });

    return res.status(201).json({ booking });
  } catch (err) {
    console.error('create booking error:', err);
    return res.status(500).json({ error: 'No se pudo crear la reserva' });
  }
};

/**
 * Mis reservas (como viajero)
 */
exports.mine = async (req, res) => {
  try {
    const userId = req.userId;
    const bookings = await Booking.find({ traveler: userId }).sort({ createdAt: -1 });
    return res.json({ bookings });
  } catch (err) {
    console.error('mine bookings error:', err);
    return res.status(500).json({ error: 'No se pudieron listar las reservas' });
  }
};

/**
 * Reservas recibidas (como guía)
 */
exports.asGuide = async (req, res) => {
  try {
    const guideUserId = req.userId;
    const bookings = await Booking.find({ guide: guideUserId }).sort({ createdAt: -1 });
    return res.json({ bookings });
  } catch (err) {
    console.error('asGuide bookings error:', err);
    return res.status(500).json({ error: 'No se pudieron listar las reservas del guía' });
  }
};

/**
 * Confirmar una reserva (solo guía dueño de la reserva)
 * Transición: pending -> confirmed
 */
exports.confirm = async (req, res) => {
  try {
    const userId = req.userId; // guía autenticado
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

    if (String(booking.guide) !== String(userId)) {
      return res.status(403).json({ error: 'No autorizado: no sos el guía de esta reserva' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: `Solo se puede confirmar si está 'pending' (actual: ${booking.status})` });
    }

    booking.status = 'confirmed';
    await booking.save();

    return res.json({ booking });
  } catch (err) {
    console.error('confirm booking error:', err);
    return res.status(500).json({ error: 'No se pudo confirmar la reserva' });
  }
};

/**
 * Cancelar una reserva
 * - Guía puede cancelar si está pending
 * - Viajero puede cancelar si NO está confirmed (o si está confirmed, acá lo forzamos a 400 por simpleza de MVP)
 *   (Podemos ajustar reglas después)
 */
exports.cancel = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

    const isGuide = String(booking.guide) === String(userId);
    const isTraveler = String(booking.traveler) === String(userId);

    if (!isGuide && !isTraveler) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Reglas simples MVP:
    if (isGuide) {
      if (booking.status !== 'pending') {
        return res.status(400).json({ error: 'El guía solo puede cancelar si está pending' });
      }
    } else if (isTraveler) {
      if (booking.status === 'confirmed') {
        return res.status(400).json({ error: 'El viajero no puede cancelar una reserva ya confirmada' });
      }
    }

    booking.status = 'canceled';
    await booking.save();

    return res.json({ booking });
  } catch (err) {
    console.error('cancel booking error:', err);
    return res.status(500).json({ error: 'No se pudo cancelar la reserva' });
  }
};
