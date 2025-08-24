// src/controllers/availability.controller.js
const Availability = require('../models/Availability');

// Crea un bloque de disponibilidad para el guía autenticado
exports.create = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });

    const { startAt, endAt } = req.body;
    if (!startAt || !endAt) return res.status(400).json({ error: 'Faltan startAt y/o endAt' });

    const start = new Date(startAt);
    const end   = new Date(endAt);
    if (isNaN(start) || isNaN(end)) return res.status(400).json({ error: 'Fechas inválidas' });
    if (start >= end) return res.status(400).json({ error: 'startAt debe ser menor a endAt' });

    // No permitir solapamientos con bloques existentes del mismo guía
    const overlap = await Availability.findOne({
      guideUserId: req.userId,
      $or: [
        { startAt: { $lt: end }, endAt: { $gt: start } }, // rango se cruza
      ],
    });

    if (overlap) return res.status(409).json({ error: 'Rango solapado con otro bloque' });

    const block = await Availability.create({
      guideUserId: req.userId,
      startAt: start,
      endAt: end,
    });

    return res.status(201).json({ block });
  } catch (err) {
    console.error('availability.create error:', err);
    return res.status(500).json({ error: 'No se pudo crear disponibilidad' });
  }
};

// Lista MIS bloques (guía autenticado)
exports.mine = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    const now = new Date();
    const blocks = await Availability.find({ guideUserId: req.userId, endAt: { $gte: now } })
      .sort({ startAt: 1 })
      .limit(200);
    return res.json({ blocks });
  } catch (err) {
    console.error('availability.mine error:', err);
    return res.status(500).json({ error: 'No se pudo listar disponibilidad' });
  }
};

// Lista bloques públicos de un guía por su userId
exports.listByGuide = async (req, res) => {
  try {
    const { guideUserId } = req.params;
    if (!guideUserId) return res.status(400).json({ error: 'Falta guideUserId' });
    const now = new Date();
    const blocks = await Availability.find({ guideUserId, endAt: { $gte: now } })
      .sort({ startAt: 1 })
      .limit(200);
    return res.json({ blocks });
  } catch (err) {
    console.error('availability.listByGuide error:', err);
    return res.status(500).json({ error: 'No se pudo listar disponibilidad del guía' });
  }
};

// Eliminar un bloque MÍO por _id
exports.remove = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });
    const { id } = req.params;
    const del = await Availability.findOneAndDelete({ _id: id, guideUserId: req.userId });
    if (!del) return res.status(404).json({ error: 'Bloque no encontrado' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('availability.remove error:', err);
    return res.status(500).json({ error: 'No se pudo eliminar el bloque' });
  }
};
