// src/middlewares/requireRole.js
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "unauthorized" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden", hint: `Requires role: ${roles.join(", ")}` });
    }
    next();
  };
}

export default requireRole;
