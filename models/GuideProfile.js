// models/GuideProfile.js
const mongoose = require('mongoose');

const guideProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, unique: true },
  bio: { type: String, trim: true, maxlength: 500 },
  languages: [{ type: String, trim: true }],
  location: { type: String, trim: true },
  pricePerHour: { type: Number, min: 0 },
}, { timestamps: true });

module.exports = mongoose.models.GuideProfile || mongoose.model('GuideProfile', guideProfileSchema);
