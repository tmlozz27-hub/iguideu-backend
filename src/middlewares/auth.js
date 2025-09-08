import jwt from "jsonwebtoken";

export const requireAuth = (req, res, next) => {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: "unauthorized" });
    const payload = jwt.verify(token, process.env.JWT_SECRET); // { id, email, role }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "unauthorized" });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: "forbidden" });
  next();
};

export const isSelfOrAdmin = (param = "id") => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "unauthorized" });
  if (req.user.role === "admin" || req.user.id === req.params[param]) return next();
  return res.status(403).json({ error: "forbidden" });
};

export default { requireAuth, requireRole, isSelfOrAdmin };
