import jwt from "jsonwebtoken";

function fromReqOrHeader(reqOrHeader) {
  if (typeof reqOrHeader === "string") return reqOrHeader;
  return String(reqOrHeader?.headers?.authorization || "");
}

export function readBearerToken(reqOrHeader) {
  const raw = String(fromReqOrHeader(reqOrHeader) || "").trim();
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}

export function decodeDevToken(token) {
  if (!String(token || "").startsWith("DEV_TOKEN_")) return "";
  const encoded = String(token).slice("DEV_TOKEN_".length);
  try {
    return Buffer.from(encoded, "base64").toString("utf8").trim().toLowerCase();
  } catch {
    return "";
  }
}

export function buildUserFromToken(token) {
  const cleanToken = String(token || "").trim();

  if (!cleanToken) {
    return { ok: false, error: "missing_token", status: 401 };
  }

  if (cleanToken.startsWith("DEV_TOKEN_")) {
    const email = decodeDevToken(cleanToken);
    if (!email) {
      return { ok: false, error: "invalid_token", status: 401 };
    }

    return {
      ok: true,
      user: {
        id: "",
        email,
        role: "traveler",
        tokenType: "dev"
      }
    };
  }

  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "";

  if (!secret) {
    return { ok: false, error: "jwt_secret_missing", status: 500 };
  }

  try {
    const payload = jwt.verify(cleanToken, secret);
    const user = {
      id: String(payload.sub || ""),
      email: String(payload.email || "").trim().toLowerCase(),
      role: String(payload.role || "traveler"),
      tokenType: "jwt"
    };

    if (!user.email) {
      return { ok: false, error: "invalid_token", status: 401 };
    }

    return { ok: true, user };
  } catch {
    return { ok: false, error: "invalid_token", status: 401 };
  }
}

export function getAuthUserFromRequest(req) {
  const token = readBearerToken(req);
  return buildUserFromToken(token);
}
