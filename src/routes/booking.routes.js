const express = require('express');
const auth = require('../middleware/auth');
const {
  create, mine, listByGuide, cancelMine,
  mineAsGuide, confirmAsGuide, markPaidDev, completeAsGuide, myEarnings
} = require('../controllers/booking.controller');

const router = express.Router();

router.post('/', auth, create);                       // crear reserva
router.get('/mine', auth, mine);                      // mis reservas (traveler)
router.get('/guide/:guideId', listByGuide);           // reservas de un guía (público)
router.post('/:id/cancel', auth, cancelMine);         // cancelar mi reserva (traveler)

router.get('/me/guide', auth, mineAsGuide);           // reservas donde soy guía
router.post('/:id/confirm', auth, confirmAsGuide);    // guía confirma
router.post('/:id/paid-dev', auth, markPaidDev);      // guía marca pagada (solo dev/QA)
router.post('/:id/complete', auth, completeAsGuide);  // guía completa (tras pago)
router.get('/me/earnings', auth, myEarnings);         // resumen de ganancias

module.exports = router;
