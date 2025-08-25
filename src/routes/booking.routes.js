const express = require('express');
const router = express.Router();

const auth = require('../middlewares/auth');
const { createBooking, confirmBooking, cancelBooking } = require('../controllers/booking.controller');

router.post('/bookings', auth, createBooking);
router.patch('/bookings/:id/confirm', auth, confirmBooking);
router.patch('/bookings/:id/cancel', auth, cancelBooking);

module.exports = router;

