// src/routes/booking.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const bookingCtrl = require('../controllers/booking.controller');

// Crear reserva (viajero)
router.post('/', auth, bookingCtrl.create);

// Mis reservas como viajero
router.get('/mine', auth, bookingCtrl.mine);

// Reservas que recibo como guía
router.get('/as-guide', auth, bookingCtrl.asGuide);

// Confirmar (guía)
router.post('/:id/confirm', auth, bookingCtrl.confirm);

// Cancelar (guía o viajero con reglas MVP)
router.post('/:id/cancel', auth, bookingCtrl.cancel);

module.exports = router;
