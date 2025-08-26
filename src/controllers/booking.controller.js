// src/controllers/booking.controller.js
// Store en memoria + reglas de confirm/cancel + anti-solapamiento + reset + listado

const crypto = require('crypto');

// ---- In-memory store (se reinicia al reiniciar el server) ----
const store = {
  bookings: [], // cada booking: {_id, traveler, guide, startAt, endAt, priceUSD, status:'pending'|'confirmed'|'canceled'}
};

// ---- Helpers ----
function newId() {
  // 24 hex (como ObjectId) para tests cómodos
  return crypto.randomBytes(12).toString('hex');
}

function parseISO(d) {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) throw new Error('Fecha inválida');
  return dt;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// ---- Controllers ----
exports.resetMemory = (req, res) => {
  store.bookings = [];
  res.json({ ok: true, cleared: true, count: 0 });
};

exports.listBookings = (req, res) => {
  res.json({ bookings: store.bookings });
};

exports.createBooking = (req, res) => {
  try {
    const { guideId, startAt, endAt, priceUSD } = req.body || {};
    if (!req.user?.id || !req.user?.role) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (req.user.role !== 'traveler') {
      return res.status(403).json({ error: 'Solo traveler puede crear' });
    }
    if (!guideId || !startAt || !endAt || typeof priceUSD !== 'number') {
      return res.status(400).json({ error: 'Campos requeridos: guideId, startAt, endAt, priceUSD(number)' });
    }

    const start = parseISO(startAt);
    const end = parseISO(endAt);
    if (!(start < end)) return res.status(400).json({ error: 'Rango horario inválido' });

    const booking = {
      _id: newId(),
      traveler: req.user.id,
      guide: guideId,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      priceUSD,
      status: 'pending',
    };
    store.bookings.push(booking);
    res.status(201).json({ booking });
  } catch (e) {
    console.warn('createBooking error:', e.message);
    res.status(500).json({ error: 'createBooking failed' });
  }
};

exports.confirmBooking = (req, res) => {
  try {
    if (!req.user?.id || !req.user?.role) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const id = req.params.id;
    const bk = store.bookings.find(b => b._id === id);
    if (!bk) return res.status(404).json({ error: 'Booking no encontrado' });

    if (req.user.role !== 'guide' || req.user.id !== bk.guide) {
      return res.status(403).json({ error: 'Solo el guía dueño puede confirmar' });
    }
    if (bk.status === 'canceled') {
      return res.status(409).json({ error: 'No se puede confirmar un booking cancelado' });
    }
    if (bk.status === 'confirmed') {
      return res.status(200).json({ booking: bk }); // ya estaba confirmado
    }

    // Anti-solapamiento: el guía no puede tener otro booking confirmado que pise el horario
    const s = parseISO(bk.startAt);
    const e = parseISO(bk.endAt);
    const conflict = store.bookings.find(b =>
      b._id !== bk._id &&
      b.guide === bk.guide &&
      b.status === 'confirmed' &&
      overlaps(s, e, parseISO(b.startAt), parseISO(b.endAt))
    );
    if (conflict) {
      return res.status(409).json({
        error: 'overlap',
        message: 'El guía ya tiene un booking confirmado que se solapa',
        conflictId: conflict._id
      });
    }

    bk.status = 'confirmed';
    res.json({ booking: bk });
  } catch (e) {
    console.warn('confirmBooking error:', e.message);
    res.status(500).json({ error: 'confirmBooking failed' });
  }
};

exports.cancelBooking = (req, res) => {
  try {
    if (!req.user?.id || !req.user?.role) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const id = req.params.id;
    const bk = store.bookings.find(b => b._id === id);
    if (!bk) return res.status(404).json({ error: 'Booking no encontrado' });

    const isTraveler = req.user.role === 'traveler' && req.user.id === bk.traveler;
    const isGuide = req.user.role === 'guide' && req.user.id === bk.guide;

    if (!isTraveler && !isGuide) {
      return res.status(403).json({ error: 'Solo traveler dueño o guía dueño pueden cancelar' });
    }

    if (bk.status === 'canceled') {
      return res.status(409).json({ error: 'Ya estaba cancelado' });
    }

    // Regla: traveler NO puede cancelar si está confirmado
    if (isTraveler && bk.status === 'confirmed') {
      return res.status(409).json({ error: 'Traveler no puede cancelar un booking confirmado' });
    }

    // Guía puede cancelar cualquiera (pending/confirmed)
    bk.status = 'canceled';
    res.json({ booking: bk });
  } catch (e) {
    console.warn('cancelBooking error:', e.message);
    res.status(500).json({ error: 'cancelBooking failed' });
  }
};
