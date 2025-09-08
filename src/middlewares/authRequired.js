import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default async function authRequired(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const parts = h.split(" ");
    const token = parts.length === 2 ? parts[1] : null;
    if (!token) return res.status(401).json({ error: "missing bearer token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const u = await User.findById(payload.id).select("_id email name role");
    if (!u) return res.status(401).json({ error: "invalid token" });

    req.user = { id: String(u._id), email: u.email, name: u.name, role: u.role };
    next();
  } catch (e) {
    return res.status(401).json({ error: "invalid token" });
  }
}
