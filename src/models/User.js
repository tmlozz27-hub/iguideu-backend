import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['traveler', 'guide', 'admin'], default: 'traveler' },
    fullName: { type: String, trim: true },
    isActive: { type: Boolean, default: true },

    // Seguridad: lockout
    failedLogin: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    refreshTokens: [
      {
        tokenHash: { type: String },
        expiresAt: { type: Date }
      }
    ],
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

UserSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > new Date();
};

UserSchema.methods.registerFailedLogin = async function (maxFails, lockMinutes) {
  this.failedLogin = (this.failedLogin || 0) + 1;
  if (this.failedLogin >= maxFails) {
    this.lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
    this.failedLogin = 0; // resetea el contador tras bloquear
  }
  await this.save();
};

UserSchema.methods.resetLoginFailures = async function () {
  if (this.failedLogin !== 0 || this.lockUntil) {
    this.failedLogin = 0;
    this.lockUntil = null;
    await this.save();
  }
};

UserSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const User = mongoose.model('User', UserSchema);

