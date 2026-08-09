import jwt from "jsonwebtoken";

function readBearer(req) {
  const raw = String(req.headers?.authorization || "").trim();
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}


export function requireAuth(req, res, next) {
  try {
    const token = readBearer(req);

    if (!token) {
      return res.status(401).json({ ok: false, error: "missing_token" });
    }


    const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "";

    if (!secret) {
      return res.status(500).json({ ok: false, error: "jwt_secret_missing" });
    }

    const payload = jwt.verify(token, secret, {
      issuer: "iguideu-backend",
      audience: "iguideu-mobile"
    });

    req.user = {
      id: String(payload.sub || ""),
      email: String(payload.email || "").trim().toLowerCase(),
      role: String(payload.role || "traveler"),
      tokenType: "jwt"
    };

    if (!req.user.email) {
      return res.status(401).json({ ok: false, error: "invalid_token" });
    }

    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }
}