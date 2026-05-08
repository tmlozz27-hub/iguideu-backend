import { getAuthUserFromRequest } from "../lib/auth-user.js";

export function requireAuth(req, res, next) {
  const result = getAuthUserFromRequest(req);

  if (!result.ok) {
    return res.status(result.status).json({ ok: false, error: result.error });
  }

  req.user = result.user;
  return next();
}