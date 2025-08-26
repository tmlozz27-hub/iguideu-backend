// src/routes/booking.routes.js
const { Router } = require('express');
const router = Router();

const auth = require('../middlewares/auth');

const {
  resetMemory,
  listBookings,
  createBooking,
  confirmBooking,
  cancelBooking
} = require('../controllers/booking.controller');

// Health simple también podría ir en server.js (ya lo tenés allí)

// ---- Utilidades de test ----
router.post('/_reset', resetMemory); // limpia store en memoria

// ---- Bookings ----
router.get('/bookings', listBookings);
router.post('/bookings', auth, createBooking);
router.patch('/bookings/:id/confirm', auth, confirmBooking);
router.patch('/bookings/:id/cancel', auth, cancelBooking);

module.exports = router;
