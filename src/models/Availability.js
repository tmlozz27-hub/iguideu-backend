// src/models/Availability.js
const mongoose = require('mongoose');

const AvailabilitySchema = new mongoose.Schema({
  guideUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startAt:     { type: Date, required: true, index: true },
  endAt:       { type: Date, required: true, index: true },
}, { timestamps: true });

// Validación simple
AvailabilitySchema.pre('validate', function(next) {
  if (this.startAt >= this.endAt) {
    return next(new Error('startAt debe ser menor a endAt'));
  }
  next();
});

// Para listados rápidos
AvailabilitySchema.index({ guideUserId: 1, startAt: 1, endAt: 1 });

module.exports = mongoose.model('Availability', AvailabilitySchema);
