const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },

    role: {
      type: String,
      enum: ["guide", "traveler", "admin"],
      default: "traveler",
    },

    country: { type: String, trim: true },
    city: { type: String, trim: true },
    languages: [{ type: String, trim: true }],
    bio: { type: String, trim: true },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Para no devolver el hash cuando hacemos JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
