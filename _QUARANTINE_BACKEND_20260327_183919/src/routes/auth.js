// src/routes/auth.js
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const router = express.Router();

function signAccess({ id, email, role }) {
  return jwt.sign(
    { sub: id, email, role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || "15m" }
  );
}

function signRefresh({ id, email, role }) {
  return jwt.sign(
    { sub: id, email, role, typ: "refresh" },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || "30d" }
  );
}

router.get("/health", (req, res) => {
  res.json({ ok: true, service: "auth" });
});

router.post("/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const role = String(req.body?.role || "traveler").trim();

  if (!email || !email.includes("@")) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }
  if (!["traveler", "guide", "admin"].includes(role)) {
    return res.status(400).json({ ok: false, error: "invalid_role" });
  }

  const id = crypto.createHash("sha256").update(email).digest("hex").slice(0, 24);

  const accessToken = signAccess({ id, email, role });
  const refreshToken = signRefresh({ id, email, role });

  return res.json({
    ok: true,
    user: { id, email, role },
    accessToken,
    refreshToken,
  });
});

router.post("/refresh", (req, res) => {
  try {
    const token = String(req.body?.refreshToken || "");
    if (!token) return res.status(400).json({ ok: false, error: "missing_refresh" });

    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    if (payload.typ !== "refresh") {
      return res.status(401).json({ ok: false, error: "invalid_refresh" });
    }

    const id = payload.sub;
    const email = payload.email;
    const role = payload.role || "traveler";

    const accessToken = signAccess({ id, email, role });
    return res.json({ ok: true, accessToken });
  } catch (e) {
    return res.status(401).json({ ok: false, error: "invalid_refresh" });
  }
});

export default router;
