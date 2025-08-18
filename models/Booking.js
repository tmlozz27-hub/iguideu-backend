const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  guideId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  customerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  startAt:     { type: Date, required: true },
  endAt:       { type: Date, required: true },
  status:      { type: String, enum: ['pending','confirmed','rejected','cancelled'], default: 'pending', index: true },
  notes:       { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });

module.exports = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
