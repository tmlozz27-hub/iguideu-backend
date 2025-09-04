import jwt from "jsonwebtoken";

export function authRequired(req, res, next) {
  const hdr = req.get("Authorization") || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    req.user = { id: payload.sub, role: payload.role || "traveler" };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function signToken({ userId, role = "traveler" }) {
  return jwt.sign({ role }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    subject: String(userId),
    expiresIn: process.env.JWT_EXPIRES || "2d"
  });
}
