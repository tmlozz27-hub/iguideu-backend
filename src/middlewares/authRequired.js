// src/middlewares/authRequired.js
import jwt from "jsonwebtoken";

export default function authRequired(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const [scheme, token] = h.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "invalid token" });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role || "user" };
    return next();
  } catch (err) {
    return res.status(401).json({ error: "invalid token" });
  }
}
