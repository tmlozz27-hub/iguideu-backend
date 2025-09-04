const express = require('express');
const router = express.Router();

// Memoria en proceso
const DB = {
  bookings: [],
};

// Helpers
function iso(s) { return new Date(s); }
function overlaps(aStart, aEnd, bStart, bEnd) {
  return iso(aStart) < iso(bEnd) && iso(bStart) < iso(aEnd);
}
function nextId() {
  return Date.now().toString() + Math.floor(Math.random()*1e6).toString().padStart(6,'0');
}

function calcSettlement(b, reason) {
  const now = new Date();
  const hoursBefore = Math.max(0, (iso(b.startAt) - now) / 36e5);
  let refundPct = 0;
  if (hoursBefore >= 48) refundPct = 100;
  else if (hoursBefore >= 24) refundPct = 50;
  else refundPct = 0;

  const refundToTraveler = Math.round(b.price * (refundPct/100));
  const keepByGuide = b.price - refundToTraveler;

  return {
    actor: reason,
    reason,
    hoursBefore: Math.floor(hoursBefore),
    refundPct,
    refundToTraveler,
    keepByGuide,
    fee: 0,
  };
}

// GET /bookings
router.get('/bookings', (req, res) => {
  res.json({ bookings: DB.bookings });
});

// POST /bookings  { guide, startAt, endAt, price }
router.post('/bookings', (req, res) => {
  const { guide, startAt, endAt, price } = req.body || {};
  if (!guide || !startAt || !endAt || typeof price !== 'number') {
    return res.status(400).json({ error: 'invalid_body' });
  }
  if (iso(endAt) <= iso(startAt)) {
    return res.status(400).json({ error: 'end_before_start' });
  }
  if (price <= 0) {
    return res.status(400).json({ error: 'invalid_price' });
  }

  // Si existe confirmado que solapa con el mismo guía → devolvemos pending (permitimos crear) o 409 según prefieras.
  const hasOverlapConfirmed = DB.bookings.some(b =>
    b.guide === guide && b.status === 'confirmed' && overlaps(b.startAt, b.endAt, startAt, endAt)
  );

  const b = {
    _id: nextId(),
    traveler: 'tom@example.com',
    guide,
    startAt,
    endAt,
    status: hasOverlapConfirmed ? 'pending' : 'pending', // siempre pending al crear
    price,
  };
  DB.bookings.push(b);
  return res.status(hasOverlapConfirmed ? 200 : 201).json({ booking: b });
});

// PATCH /bookings/:id/confirm
router.patch('/bookings/:id/confirm', (req, res) => {
  const id = req.params.id;
  const b = DB.bookings.find(x => x._id === id);
  if (!b) return res.status(404).json({ error: 'not_found' });
  if (b.status === 'confirmed') return res.json({ booking: b });
  if (b.status === 'canceled') return res.status(409).json({ error: 'already_canceled' });

  const conflict = DB.bookings.find(x =>
    x._id !== b._id &&
    x.guide === b.guide &&
    x.status === 'confirmed' &&
    overlaps(x.startAt, x.endAt, b.startAt, b.endAt)
  );
  if (conflict) {
    return res.status(409).json({ error: 'overlap', conflict: conflict._id });
  }

  b.status = 'confirmed';
  console.log('[NOTIFY] confirmed', {
    _id: b._id, traveler: b.traveler, guide: b.guide,
    status: b.status, startAt: b.startAt, endAt: b.endAt
  });
  return res.json({ booking: b });
});

// PATCH /bookings/:id/cancel  { reason }
router.patch('/bookings/:id/cancel', (req, res) => {
  const id = req.params.id;
  const { reason = 'traveler_cancel' } = req.body || {};
  const b = DB.bookings.find(x => x._id === id);
  if (!b) return res.status(404).json({ error: 'not_found' });
  if (b.status === 'canceled') return res.json({ booking: b });

  b.status = 'canceled';
  b.cancelInfo = {
    at: new Date().toISOString(),
    reason,
    settlement: calcSettlement(b, reason),
  };

  console.log('[NOTIFY] canceled', {
    _id: b._id, traveler: b.traveler, guide: b.guide,
    status: b.status, startAt: b.startAt, endAt: b.endAt,
    cancelInfo: b.cancelInfo
  });

  return res.json({ booking: b });
});

// DEBUG opcional: reset memoria
router.post('/bookings/debug/reset', (req, res) => {
  DB.bookings = [];
  res.json({ ok: true });
});

module.exports = router;
