// src/models/GuideProfile.js
const mongoose = require('mongoose');

const GuideProfileSchema = new mongoose.Schema({
  // ⚠️ usar userId porque el índice único existente es userId_1
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

  bio: { type: String, maxlength: 1500 },
  languages: { type: [String], default: [] }, // ej: ["es","en","pt"]
  pricePerHourUSD: { type: Number, min: 5, max: 500, required: true },

  country: { type: String, trim: true },
  city: { type: String, trim: true },
  avatarUrl: { type: String, trim: true },

  isActive: { type: Boolean, default: true, index: true },

  ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

GuideProfileSchema.index({ country: 1, city: 1, isActive: 1 });
GuideProfileSchema.index({ pricePerHourUSD: 1 });
GuideProfileSchema.index({ languages: 1 });

module.exports = mongoose.model('GuideProfile', GuideProfileSchema);
// Agrega debajo de la definición del schema, antes del module.exports
GuideProfileSchema.index({ isActive: 1, country: 1, city: 1 });
GuideProfileSchema.index({ isActive: 1, languages: 1 });
GuideProfileSchema.index({ isActive: 1, pricePerHourUSD: 1 });
GuideProfileSchema.index({ createdAt: 1 });
