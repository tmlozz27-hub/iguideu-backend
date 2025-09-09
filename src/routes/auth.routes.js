// src/routes/auth.routes.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import authRequired from "../middlewares/authRequired.js";

const router = Router();

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: "bad_request" });

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: "email_taken" });

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, password: hash, name, role: "user" });

  return res.json({ ok: true, user: { id: user._id, email: user.email, name: user.name } });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "invalid_credentials" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role || "user" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.json({
    token,
    user: { id: user._id, email: user.email, name: user.name, role: user.role || "user" },
  });
});

// GET /api/auth/me
router.get("/me", authRequired, async (req, res) => {
  const user = await User.findById(req.user.id).select("_id email name role");
  if (!user) return res.status(404).json({ error: "not_found" });
  return res.json({ user });
});

export default router;
