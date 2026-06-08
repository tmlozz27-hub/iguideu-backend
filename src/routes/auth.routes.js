import { Resend } from "resend";
import { Router } from "express";
import { User } from "../models/User.js";
import { auth } from "../middlewares/auth.js";
import { body, validationResult } from "express-validator";
import { createAccessToken, createRefreshToken, verifyRefreshToken, sha256 } from "../utils/tokens.js";

const router = Router();

// helper validación
const validate = (rules) => [
  ...rules,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: "Validation error", details: errors.array() });
    next();
  },
];

// helpers cookies
function setRefreshCookie(res, token) {
  const prod = process.env.NODE_ENV === "production";
  res.cookie("rt", token, {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    path: "/api/auth",
  });
}
function clearRefreshCookie(res) {
  const prod = process.env.NODE_ENV === "production";
  res.clearCookie("rt", {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? "none" : "lax",
    path: "/api/auth",
  });
}

// REGISTER
router.post(
  "/auth/register",
  validate([
    body("email").isEmail().withMessage("email inválido").normalizeEmail(),
    body("password").isString().isLength({ min: 8 }).withMessage("password mínimo 8"),
    body("fullName").optional().isString().isLength({ min: 2, max: 80 }),
    body("role").optional().isIn(["traveler", "guide", "admin"]),
  ]),
  async (req, res, next) => {
    try {
      const { email, password, fullName, role } = req.body || {};
      const exists = await User.findOne({ email });
      if (exists) return res.status(409).json({ error: "Email ya registrado" });

      const user = await User.create({ email, password, fullName, role });

      const access = createAccessToken({ id: user._id, role: user.role });
      const refresh = createRefreshToken({ id: user._id });

      const tokenHash = sha256(refresh);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      user.refreshTokens.push({ tokenHash, expiresAt });
      await user.save();

      setRefreshCookie(res, refresh);
      res.status(201).json({ user: user.toSafeJSON(), token: access });
    } catch (err) { next(err); }
  }
);

// LOGIN (con lockout ya implementado en el modelo)
router.post(
  "/auth/login",
  validate([
    body("email").isEmail().withMessage("email inválido").normalizeEmail(),
    body("password").isString().isLength({ min: 8 }),
  ]),
  async (req, res, next) => {
    try {
      const MAX_FAILS = parseInt(process.env.AUTH_MAX_FAILS || "5", 10);
      const LOCK_MIN = parseInt(process.env.AUTH_LOCK_MINUTES || "15", 10);

      const { email, password } = req.body || {};
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

      if (user.isLocked()) {
        return res.status(423).json({ error: "Cuenta bloqueada temporalmente. Reintentá más tarde." });
      }

      const ok = await user.comparePassword(password);
      if (!ok) {
        await user.registerFailedLogin(MAX_FAILS, LOCK_MIN);
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      await user.resetLoginFailures();

      const access = createAccessToken({ id: user._id, role: user.role });
      const refresh = createRefreshToken({ id: user._id });

      const tokenHash = sha256(refresh);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      user.refreshTokens.push({ tokenHash, expiresAt });
      await user.save();

      setRefreshCookie(res, refresh);
      res.json({ user: user.toSafeJSON(), token: access });
    } catch (err) { next(err); }
  }
);

// REFRESH
router.post("/auth/refresh", async (req, res, next) => {
  try {
    const rt = req.cookies?.rt;
    if (!rt) return res.status(401).json({ error: "No refresh token" });

    let payload;
    try { payload = verifyRefreshToken(rt); }
    catch { return res.status(401).json({ error: "Invalid refresh token" }); }

    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: "Invalid refresh token" });

    const hash = sha256(rt);
    const found = user.refreshTokens.find((t) => t.tokenHash === hash && t.expiresAt > new Date());
    if (!found) return res.status(401).json({ error: "Refresh token revoked/expired" });

    // rotación
    user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== hash);
    const newRefresh = createRefreshToken({ id: user._id });
    const newHash = sha256(newRefresh);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.refreshTokens.push({ tokenHash: newHash, expiresAt });
    await user.save();

    setRefreshCookie(res, newRefresh);
    const access = createAccessToken({ id: user._id, role: user.role });
    res.json({ token: access });
  } catch (err) { next(err); }
});

// LOGOUT
router.post("/auth/logout", async (req, res, next) => {
  try {
    const rt = req.cookies?.rt;
    if (rt) {
      try {
        const payload = verifyRefreshToken(rt);
        const user = await User.findById(payload.id);
        if (user) {
          const hash = sha256(rt);
          user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== hash);
          await user.save();
        }
      } catch {}
    }
    clearRefreshCookie(res);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

const resetTokens = new Map();

async function sendPasswordResetEmail(to, token) {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  if (!resend) {
    console.log("RESEND_NOT_CONFIGURED");
    return false;
  }

  const resendResult = await resend.emails.send({
    from: process.env.MAIL_FROM || "I GUIDE U <onboarding@resend.dev>",
    to,
    subject: "I GUIDE U - Recuperar contraseña",
    text: `Tu código de recuperación de I GUIDE U es: ${token}

Este código vence en 30 minutos.

Si no pediste recuperar tu contraseña, ignorá este email.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2>I GUIDE U</h2>
        <p>Tu código de recuperación es:</p>
        <p style="font-size:22px;font-weight:700;letter-spacing:1px">${token}</p>
        <p>Este código vence en 30 minutos.</p>
        <p>Si no pediste recuperar tu contraseña, ignorá este email.</p>
      </div>
    `
  });
  console.log("RESEND_RESULT", JSON.stringify(resendResult));
  return true;
}

router.post("/auth/forgot-password", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "EMAIL_REQUIRED" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ ok: true, message: "If the email exists, recovery instructions were sent." });
    }

    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);

    resetTokens.set(token, {
      userId: String(user._id),
      expiresAt: Date.now() + 1000 * 60 * 30
    });

    const emailSent = await sendPasswordResetEmail(email, token);

    return res.json({
      ok: true,
      message: "If the email exists, recovery instructions were sent.",
      emailSent,
      token
    });
  } catch (err) {
    next(err);
  }
});

router.post("/auth/reset-password", async (req, res, next) => {
  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "").trim();

    if (!token) {
      return res.status(400).json({ ok: false, error: "TOKEN_REQUIRED" });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ ok: false, error: "PASSWORD_MIN_6" });
    }

    const entry = resetTokens.get(token);

    if (!entry || entry.expiresAt < Date.now()) {
      return res.status(400).json({ ok: false, error: "TOKEN_INVALID_OR_EXPIRED" });
    }

    const user = await User.findById(entry.userId);

    if (!user) {
      resetTokens.delete(token);
      return res.status(400).json({ ok: false, error: "TOKEN_INVALID_OR_EXPIRED" });
    }

    user.password = password;
    user.failedLogin = 0;
    user.lockUntil = null;
    await user.save();

    resetTokens.delete(token);

    return res.json({ ok: true, message: "Password updated." });
  } catch (err) {
    next(err);
  }
});

// ME
router.get("/auth/me", auth(true), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ user: user.toSafeJSON() });
  } catch (err) { next(err); }
});

export default router;




