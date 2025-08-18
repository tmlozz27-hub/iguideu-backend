// models/GuideProfile.js
const mongoose = require('mongoose');

const guideProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true, unique: true },
  displayName: { type: String, required: true, trim: true, minlength: 2 },
  bio: { type: String, trim: true, maxlength: 1000 },
  languages: { type: [String], default: [] },   // ej: ["es","en"]
  city: { type: String, trim: true },           // ej: "Buenos Aires"
  ratePerHour: { type: Number, min: 0 },
  available: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.models.GuideProfile || mongoose.model('GuideProfile', guideProfileSchema);
