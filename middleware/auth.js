// middleware/auth.js
// =====================================================
// AUTH middleware (simple, seguro y con BYPASS público)
// PUBLICO:
// - GET  /api/health
// - GET  /api/guides
// - POST /api/bookings
// - GET  /api/bookings?email=...
// - POST /api/payments/create-intent
// - POST /api/stripe/webhook  (Stripe)
// - /api/register, /api/login, /api/refresh
// TODO lo demás requiere Bearer token
// =====================================================

function normalizeUrl(req) {
  const u = String(req.originalUrl || req.url || "");
  return u.split("?")[0] || u;
}

function isPublicRequest(req) {
  const path = normalizeUrl(req);

  // Health
  if (req.method === "GET" && path === "/api/health") return true;

  // Guides público
  if (req.method === "GET" && path.startsWith("/api/guides")) return true;

  // Auth endpoints públicos
  if (path === "/api/register" && req.method === "POST") return true;
  if (path === "/api/login" && req.method === "POST") return true;
  if (path === "/api/refresh" && req.method === "POST") return true;

  // Bookings públicos:
  // POST /api/bookings
  if (path === "/api/bookings" && req.method === "POST") return true;

  // GET /api/bookings?email=...
  if (path === "/api/bookings" && req.method === "GET") {
    const email = String(req.query?.email || "").trim();
    if (email) return true;
  }

  // Payments: create intent (si tu app no manda Bearer)
  if (path === "/api/payments/create-intent" && req.method === "POST") return true;
  if (path === "/api/payments/checkout" && req.method === "POST") return true;


  // Stripe webhook siempre público
  if (path === "/api/stripe/webhook" && req.method === "POST") return true;

  return false;
}

function readBearerToken(req) {
  const authHeader = String(req.headers["authorization"] || "");
  const parts = authHeader.split(" ").filter(Boolean);
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return null;
}

export default function auth(req, res, next) {
  try {
    if (isPublicRequest(req)) return next();

    const token = readBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Missing Bearer token" });
    }

    // ✅ Por ahora: aceptamos cualquier token no vacío (modo dev)
    // TODO: validar JWT/Firebase/etc.
    req.user = { token };
    return next();
  } catch (e) {
    return res.status(500).json({ ok: false, error: "AUTH_MIDDLEWARE_FAILED" });
  }
}
