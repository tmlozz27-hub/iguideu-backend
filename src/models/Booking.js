const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  traveler: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  guide:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startAt:  { type: Date, required: true },
  endAt:    { type: Date, required: true },
  priceUSD: { type: Number, required: true, min: 1 },   // precio total a cobrar
  commissionPct: { type: Number, default: 10 },         // % comisión I GUIDE U
  status: { type: String, enum: ['pending','confirmed','paid','cancelled'], default: 'pending', index: true },
  stripePaymentId: { type: String },
}, { timestamps: true });

BookingSchema.virtual('commissionUSD').get(function () {
  return Math.round(this.priceUSD * (this.commissionPct / 100) * 100) / 100;
});
BookingSchema.virtual('payoutUSD').get(function () {
  return Math.round((this.priceUSD - this.commissionUSD) * 100) / 100;
});

module.exports = mongoose.model('Booking', BookingSchema);
