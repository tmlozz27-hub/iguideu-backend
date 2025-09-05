import mongoose from "mongoose";
import bcrypt from "bcrypt";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
  },
  { timestamps: true }
);

// Hash on create/update if password changed
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
  this.password = await bcrypt.hash(this.password, rounds);
  next();
});

// Método seguro para comparar
UserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Ocultar password en JSON
UserSchema.methods.toJSON = function () {
  const obj = this.toObject({ versionKey: false });
  delete obj.password;
  return obj;
};

const User = mongoose.models.User || mongoose.model("User", UserSchema);
export default User;
