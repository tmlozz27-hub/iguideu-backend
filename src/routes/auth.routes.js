import { Router } from "express";
import User from "../models/User.js";
import { validateSignup, validateLogin } from "../middlewares/validate.js";
import { signToken } from "../middlewares/auth.js";

const router = Router();

router.post("/signup", validateSignup, async (req, res) => {
  const { email, password, name } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ error: "Email already registered" });
  const user = await User.create({ email, password, name });
  const token = signToken({ userId: user._id, role: user.role });
  res.status(201).json({ user: { id: user._id, email, name, role: user.role }, token });
});

router.post("/login", validateLogin, async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.compare(password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signToken({ userId: user._id, role: user.role });
  res.json({ user: { id: user._id, email: user.email, name: user.name, role: user.role }, token });
});

export default router;
