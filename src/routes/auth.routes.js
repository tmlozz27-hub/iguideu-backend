// src/routes/auth.routes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Usuarios en memoria (persisten mientras no reinicies el proceso)
const users = (global.__users ||= []);

// Helper para token
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "dev",
    { expiresIn: "12h" }
  );
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "bad_request" });

    const exists = users.find((u) => u.email === email);
    if (exists) return res.status(409).json({ error: "email_exists" });

    const passhash = await bcrypt.hash(password, 8);
    const safeRole = ["traveler", "guide", "admin"].includes(role) ? role : "traveler";

    const user = {
      id: Date.now().toString(),
      name: name || (email.split("@")[0]),
      email,
      passhash,
      role: safeRole,
    };
    users.push(user);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "server_error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = users.find((u) => u.email === email);
  if (!user) return res.status(401).json({ error: "invalid_credentials" });

  const ok = await bcrypt.compare(password, user.passhash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const token = signToken(user);
  return res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, name: user.name },
  });
});

module.exports = router;
