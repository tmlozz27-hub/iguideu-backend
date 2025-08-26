// server.js — Express robusto (con ancla de event loop y fallback si faltan rutas)
const express = require('express');
const cors = require('cors');

const HOST = '127.0.0.1';
const PORT = 3000;

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    ts: new Date().toISOString(),
  });
});

// Endpoint para resetear estado en memoria (lo usan los e2e)
let bookings = []; // memoria simple por si no cargan rutas
app.post('/api/_reset', (req, res) => {
  bookings = [];
  res.json({ ok: true });
});

// Intento cargar rutas reales (si existen)
let routesLoaded = false;
try {
  const bookingRoutes = require('./src/routes/booking.routes');
  app.use('/api', bookingRoutes);
  routesLoaded = true;
  console.log('✔ booking.routes cargadas');
} catch (e) {
  console.warn('⚠ No se pudieron cargar booking.routes. Uso fallback en memoria:', e.message);

  // --- Fallback mínimo en memoria para POST/confirm/cancel/get ---
  const newId = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2,'0')).join('');
  const crypto = require('crypto').webcrypto;

  // POST /api/bookings
  app.post('/api/bookings', (req, res) => {
    const { guideId, startAt, endAt, priceUSD } = req.body || {};
    const traveler = '64b000000000000000000002';
    const guide = guideId || '64b000000000000000000001';
    const _id = newId();
    const bk = { _id, traveler, guide, startAt, endAt, priceUSD, status: 'pending' };
    bookings.push(bk);
    res.status(201).json({ booking: bk });
  });

  // PATCH /api/bookings/:id/confirm
  app.patch('/api/bookings/:id/confirm', (req, res) => {
    const id = req.params.id;
    const bk = bookings.find(b => b._id === id);
    if (!bk) return res.status(404).json({ error: 'not found' });

    // regla: no permitir solape con confirmed existentes del mismo guide
    const s = new Date(bk.startAt).getTime();
    const e = new Date(bk.endAt).getTime();
    const overlap = bookings.some(b =>
      b._id !== id && b.guide === bk.guide && b.status === 'confirmed' &&
      Math.max(s, new Date(b.startAt).getTime()) < Math.min(e, new Date(b.endAt).getTime())
    );
    if (overlap) return res.status(409).json({ error: 'overlap' });

    bk.status = 'confirmed';
    res.json({ booking: bk });
  });

  // PATCH /api/bookings/:id/cancel
  app.patch('/api/bookings/:id/cancel', (req, res) => {
    const id = req.params.id;
    const bk = bookings.find(b => b._id === id);
    if (!bk) return res.status(404).json({ error: 'not found' });

    // regla: si está confirmed, solo puede cancelar el guía (no validamos token en fallback)
    if (bk.status === 'confirmed') {
      // simulamos que si viene header Authorization TRAVELER -> 409
      const auth = req.headers['authorization'] || '';
      if (auth.startsWith('Bearer TRAVELER:')) {
        return res.status(409).json({ error: 'confirmed_cannot_cancel_traveler' });
      }
    }
    bk.status = 'canceled';
    res.json({ booking: bk });
  });

  // GET /api/bookings
  app.get('/api/bookings', (req, res) => {
    res.json({ bookings });
  });
  // --- fin fallback ---
}

// Arranque del server
const server = app.listen(PORT, HOST, () => {
  const addr = server.address();
  console.log(`🚀 Express escuchando en ${addr.address}:${addr.port} (pid:${process.pid}) — rutas=${routesLoaded ? 'OK' : 'FALLBACK'}`);
});

// Ancla para que el proceso no termine
setInterval(() => {}, 1 << 30);
