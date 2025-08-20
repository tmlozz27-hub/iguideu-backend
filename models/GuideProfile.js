// models/GuideProfile.js
const mongoose = require('mongoose');

const guideProfileSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, unique: true, index: true },
  bio:         { type: String, trim: true, maxlength: 2000 },
  city:        { type: String, trim: true, index: true },
  country:     { type: String, trim: true, index: true },
  languages:   { type: [String], default: [], index: true }, // ['es','en','pt']
  pricePerHour:{ type: Number, min: 0, max: 10000, index: true },
  ratingAvg:   { type: Number, min: 0, max: 5, default: 0 },
  ratingCount: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

guideProfileSchema.index({ city: 1, pricePerHour: 1 });
guideProfileSchema.index({ languages: 1 });

module.exports = mongoose.models.GuideProfile || mongoose.model('GuideProfile', guideProfileSchema);
