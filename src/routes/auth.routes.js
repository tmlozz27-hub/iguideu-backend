import { Router } from "express";
import { signToken, requireAuth } from "../middlewares/auth.js";

const router = Router();

router.post("/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email/password required" });
    }
    const User = global.models.User;

    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ error: "email in use" });

    // NO hashees acá: el pre-save del modelo User lo hace
    const u = await User.create({ email, password, name });

    const token = signToken(u);
    res.status(201).json({ user: u.toJSON(), token });
  } catch (e) {
    console.error("POST /auth/signup error:", e);
    res.status(500).json({ error: "internal error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email/password required" });
    }
    const User = global.models.User;
    const u = await User.findOne({ email });
    if (!u) return res.status(401).json({ error: "invalid credentials" });

    const ok = await u.comparePassword(password);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    const token = signToken(u);
    res.json({ user: u.toJSON(), token });
  } catch (e) {
    console.error("POST /auth/login error:", e);
    res.status(500).json({ error: "internal error" });
  }
});

router.get("/me", requireAuth, async (_req, res) => {
  res.json({ user: _req.user });
});

export default router;
