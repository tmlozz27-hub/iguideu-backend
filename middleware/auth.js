const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "changeme";

async function authRequired(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Token requerido" });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Usuario no válido o inactivo" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Error en authRequired:", err.message);
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

module.exports = {
  authRequired,
};
