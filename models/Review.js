// models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  guide:    { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  traveler: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  rating:   { type: Number, min: 1, max: 5, required: true },
  comment:  { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });

reviewSchema.index({ guide: 1, traveler: 1, createdAt: -1 });

module.exports = mongoose.models.Review || mongoose.model('Review', reviewSchema);
