import mongoose from "mongoose";
import bcrypt from "bcrypt";

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, index: true, required: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true },
    role: { type: String, enum: ["traveler", "guide", "admin"], default: "traveler", index: true }
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.compare = function (plain) {
  return bcrypt.compare(plain, this.password);
};

export default mongoose.model("User", UserSchema);
