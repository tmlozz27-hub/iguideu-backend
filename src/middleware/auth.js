// src/middleware/auth.js
import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";

    if (!token) {
      return res.status(401).json({ ok: false, error: "missing_token" });
    }

    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Adjuntamos user al request
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    return next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }
}
