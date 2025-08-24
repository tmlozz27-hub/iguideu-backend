// src/controllers/availability.controller.js
const Availability = require('../models/Availability');
const Booking = require('../models/Booking');

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  // [aStart,aEnd) solapa [bStart,bEnd)?
  return (aStart < bEnd) && (bStart < aEnd);
}

exports.createBlock = async (req, res) => {
  try {
    const guideUserId = req.user?._id;
    if (!guideUserId) return res.status(401).json({ error: 'No autenticado' });

    const { startAt, endAt } = req.body || {};
    if (!startAt || !endAt) return res.status(400).json({ error: 'Faltan startAt/endAt' });

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (!(start < end)) return res.status(400).json({ error: 'Rango inválido' });

    // evitar solapes con otros bloques del mismo guía
    const existing = await Availability.find({ guideUserId });
    const solapa = existing.some(b => rangesOverlap(start, end, b.startAt, b.endAt));
    if (solapa) return res.status(409).json({ error: 'Rango solapado con otro bloque' });

    const block = await Availability.create({ guideUserId, startAt: start, endAt: end });
    return res.json({ block });
  } catch (err) {
    console.error('createBlock error', err);
    return res.status(500).json({ error: 'No se pudo crear disponibilidad' });
  }
};

exports.myBlocks = async (req, res) => {
  try {
    const guideUserId = req.user?._id;
    if (!guideUserId) return res.status(401).json({ error: 'No autenticado' });
    const blocks = await Availability.find({ guideUserId }).sort({ startAt: 1 });
    return res.json({ blocks });
  } catch (err) {
    console.error('myBlocks error', err);
    return res.status(500).json({ error: 'No se pudo listar' });
  }
};

exports.deleteBlock = async (req, res) => {
  try {
    const guideUserId = req.user?._id;
    if (!guideUserId) return res.status(401).json({ error: 'No autenticado' });
    const { id } = req.params;

    const block = await Availability.findOne({ _id: id, guideUserId });
    if (!block) return res.status(404).json({ error: 'Bloque no encontrado' });

    // *** NUEVO: chequear bookings pendientes/confirmados dentro del rango ***
    const activeStatuses = ['pending', 'confirmed'];
    const overlapping = await Booking.findOne({
      guide: guideUserId,
      status: { $in: activeStatuses },
      // solape de rangos: booking.startAt < block.endAt && block.startAt < booking.endAt
      startAt: { $lt: block.endAt },
      endAt: { $gt: block.startAt },
    }).lean();

    if (overlapping) {
      return res.status(409).json({ error: 'No se puede borrar: hay reservas pendientes/confirmadas dentro del rango' });
    }

    await Availability.deleteOne({ _id: id });
    return res.json({ ok: true });
  } catch (err) {
    console.error('deleteBlock error', err);
    return res.status(500).json({ error: 'No se pudo eliminar el bloque' });
  }
};
