const Booking = require('../models/Booking');
const Availability = require('../models/Availability');

// Crear reserva (traveler)
exports.create = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    const { guideId, startAt, endAt, priceUSD } = req.body;

    if (!guideId || !startAt || !endAt || !priceUSD) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Verificar disponibilidad
    const block = await Availability.findOne({
      guideUserId: guideId,
      startAt: { $lte: new Date(startAt) },
      endAt: { $gte: new Date(endAt) }
    });
    if (!block) {
      return res.status(400).json({ error: 'El rango no cae dentro de una disponibilidad del guía' });
    }

    const booking = await Booking.create({
      traveler: req.userId,
      guide: guideId,
      startAt,
      endAt,
      priceUSD,
      commissionPct: 10,
      status: 'pending'
    });

    return res.status(201).json({ booking });
  } catch (err) {
    console.error('booking.create error:', err);
    return res.status(500).json({ error: 'Error creando reserva' });
  }
};

// Mis reservas (traveler)
exports.mine = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    const bookings = await Booking.find({ traveler: req.userId }).sort({ startAt: -1 }).limit(200);
    return res.json({ bookings });
  } catch (err) {
    console.error('booking.mine error:', err);
    return res.status(500).json({ error: 'No se pudo listar mis reservas' });
  }
};

// Reservas de un guía (público)
exports.listByGuide = async (req, res) => {
  try {
    const guideId = req.params.guideId;
    const bookings = await Booking.find({ guide: guideId }).sort({ startAt: -1 }).limit(200);
    return res.json({ bookings });
  } catch (err) {
    console.error('booking.listByGuide error:', err);
    return res.status(500).json({ error: 'No se pudo listar reservas del guía' });
  }
};

// Cancelar mi reserva (traveler)
exports.cancelMine = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    const { id } = req.params;
    const booking = await Booking.findOneAndUpdate(
      { _id: id, traveler: req.userId, status: { $in: ['pending','confirmed'] } },
      { $set: { status: 'cancelled' } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada o no cancelable' });
    return res.json({ booking });
  } catch (err) {
    console.error('booking.cancelMine error:', err);
    return res.status(500).json({ error: 'No se pudo cancelar reserva' });
  }
};

// === Acciones de estado ===

// Listar reservas donde soy guía
exports.mineAsGuide = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    const bookings = await Booking.find({ guide: req.userId })
      .sort({ startAt: -1 })
      .limit(200);
    return res.json({ bookings });
  } catch (err) {
    console.error('booking.mineAsGuide error:', err);
    return res.status(500).json({ error: 'No se pudo listar mis reservas como guía' });
  }
};

// El guía confirma una reserva
exports.confirmAsGuide = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    const { id } = req.params;

    const updated = await Booking.findOneAndUpdate(
      { _id: id, guide: req.userId, status: 'pending' },
      { $set: { status: 'confirmed' } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Reserva no encontrada o no confirmable' });
    return res.json({ booking: updated });
  } catch (err) {
    console.error('booking.confirmAsGuide error:', err);
    return res.status(500).json({ error: 'No se pudo confirmar' });
  }
};

// Marcar como pagada (solo dev/QA)
exports.markPaidDev = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    const { id } = req.params;

    const updated = await Booking.findOneAndUpdate(
      { _id: id, guide: req.userId, status: 'confirmed' },
      { $set: { status: 'paid' } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Reserva no encontrada o no pagable' });
    return res.json({ booking: updated });
  } catch (err) {
    console.error('booking.markPaidDev error:', err);
    return res.status(500).json({ error: 'No se pudo marcar como pagada' });
  }
};

// Completar servicio (paid -> completed)
exports.completeAsGuide = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    const { id } = req.params;

    const updated = await Booking.findOneAndUpdate(
      { _id: id, guide: req.userId, status: 'paid' },
      { $set: { status: 'completed' } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Reserva no encontrada o no completable' });
    return res.json({ booking: updated });
  } catch (err) {
    console.error('booking.completeAsGuide error:', err);
    return res.status(500).json({ error: 'No se pudo completar' });
  }
};

// Resumen de comisiones (ganancias guía)
exports.myEarnings = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });

    const rows = await Booking.find({ guide: req.userId, status: { $in: ['paid','completed'] } })
      .select('priceUSD commissionPct startAt endAt status')
      .lean();

    let gross = 0, commission = 0, net = 0;
    for (const r of rows) {
      const p = Number(r.priceUSD) || 0;
      const pct = Number(r.commissionPct) || 0;
      const com = p * (pct / 100);
      gross += p;
      commission += com;
      net += (p - com);
    }

    return res.json({
      grossUSD: Number(gross.toFixed(2)),
      commissionUSD: Number(commission.toFixed(2)),
      netUSD: Number(net.toFixed(2)),
      count: rows.length,
      items: rows,
    });
  } catch (err) {
    console.error('booking.myEarnings error:', err);
    return res.status(500).json({ error: 'No se pudo calcular ganancias' });
  }
};
