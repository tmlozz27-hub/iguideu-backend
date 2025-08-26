const mongoose = require('mongoose');

const GuideProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      unique: true,
    },
    languages: { type: [String], default: [] },
    pricePerHourUSD: { type: Number, required: true, min: 1 },
    bio: { type: String },
    country: { type: String, maxlength: 2 },
    city: { type: String, maxlength: 80 },
    avatarUrl: { type: String },
    isActive: { type: Boolean, default: true },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// índice recomendado con filtro parcial para evitar conflictos con null
GuideProfileSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $exists: true, $type: 'objectId' } },
    name: 'userId_1',
  }
);

module.exports = mongoose.model('GuideProfile', GuideProfileSchema);
