// src/utils/notifier.js
function notifyBookingUpdate(type, booking) {
  const short = {
    _id: booking._id,
    traveler: booking.traveler,
    guide: booking.guide,
    status: booking.status,
    startAt: booking.startAt,
    endAt: booking.endAt,
    cancelInfo: booking.cancelInfo || null,
  };
  console.log(`[NOTIFY] ${type}`, short);
}

module.exports = { notifyBookingUpdate };
