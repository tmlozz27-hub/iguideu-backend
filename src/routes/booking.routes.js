const router = require('express').Router();
const { auth } = require('../middleware/auth');
const {
  createBooking,
  myBookings,
  confirmBooking,
  cancelBooking,
} = require('../controllers/booking.controller');

router.post('/', auth, createBooking);
router.get('/mine', auth, myBookings);
router.post('/:id/confirm', auth, confirmBooking);
router.post('/:id/cancel', auth, cancelBooking);

module.exports = router;
