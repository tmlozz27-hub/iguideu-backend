// models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  guide: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },   // guía
  traveler: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true }, // viajero
  date: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'cancelled'], 
    default: 'pending' 
  },
}, { timestamps: true });

module.exports = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

