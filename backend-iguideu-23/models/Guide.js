const mongoose = require("mongoose");

const guideSchema = new mongoose.Schema(
  {
    guideId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    country: { type: String, required: true },
    city: { type: String, required: true },
    priceHour: { type: Number, required: true },
    priceDay: { type: Number, required: true },
    rating: { type: Number, required: true },
    photo: { type: String, required: true },
    description: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Guide", guideSchema);
