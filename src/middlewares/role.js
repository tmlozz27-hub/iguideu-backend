// src/middlewares/role.js
// Middleware de autorización por rol
export function requireRole(...allowed) {
  return (req, res, next) => {
    try {
      const role = req.user?.role || "traveler";
      if (!allowed.includes(role)) {
        return res.status(403).json({ error: "forbidden", hint: `Se requiere rol: ${allowed.join(", ")}` });
      }
      next();
    } catch {
      return res.status(401).json({ error: "unauthorized" });
    }
  };
}

export default requireRole;
