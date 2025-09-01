// src/middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const [type, token] = auth.split(" ");
  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev");
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role || "traveler",
    };
    return next();
  } catch (e) {
    return res.status(401).json({ error: "unauthorized" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "unauthorized" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
