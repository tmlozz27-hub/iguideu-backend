import jwt from "jsonwebtoken";
import mongoose from "mongoose";

function readBearer(req) {
  const raw = String(req.headers?.authorization || "").trim();
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}


export async function requireAuth(req, res, next) {
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

    const email = String(payload.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(401).json({ ok: false, error: "invalid_token" });
    }

    const db = mongoose.connection?.db;

    if (!db) {
      return res.status(500).json({ ok: false, error: "mongo_not_connected" });
    }

    const user = await db.collection("users").findOne(
      { email },
      { projection: { tokenVersion: 1 } }
    );

    if (!user) {
      return res.status(401).json({ ok: false, error: "invalid_token" });
    }

    const tokenVersion =
      Number.isSafeInteger(Number(payload.tokenVersion))
        ? Number(payload.tokenVersion)
        : 0;

    const currentTokenVersion =
      Number.isSafeInteger(Number(user.tokenVersion))
        ? Number(user.tokenVersion)
        : 0;

    if (tokenVersion !== currentTokenVersion) {
      return res.status(401).json({ ok: false, error: "token_revoked" });
    }

    req.user = {
      id: String(payload.sub || ""),
      email,
      role: String(payload.role || "traveler"),
      tokenType: "jwt"
    };

    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }
}