import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client();

function parseClientIds(raw) {
  return String(raw || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function getAllowedClientIds() {
  return parseClientIds(process.env.GOOGLE_CLIENT_IDS);
}

export function isGoogleLegacyFallbackEnabled() {
  const raw = String(process.env.GOOGLE_AUTH_ALLOW_LEGACY_FALLBACK || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export async function verifyGoogleIdToken(idToken) {
  const token = String(idToken || "").trim();
  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  const allowedClientIds = getAllowedClientIds();

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: allowedClientIds.length ? allowedClientIds : undefined
    });

    const payload = ticket.getPayload() || {};
    const email = String(payload.email || "").trim().toLowerCase();
    const name = String(payload.name || "").trim();
    const emailVerified = payload.email_verified === true;

    if (!email) {
      return { ok: false, reason: "missing_email" };
    }

    if (!emailVerified) {
      return { ok: false, reason: "email_not_verified" };
    }

    return {
      ok: true,
      claims: {
        sub: String(payload.sub || ""),
        email,
        name
      }
    };
  } catch (error) {
    return {
      ok: false,
      reason: "verify_failed",
      detail: error?.message || "google_verify_failed"
    };
  }
}
