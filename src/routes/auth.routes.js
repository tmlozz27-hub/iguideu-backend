import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import { Resend } from "resend";
import { createRemoteJWKSet, jwtVerify } from "jose";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const usersCollection = () => mongoose.connection.db.collection("users");

const PASSWORD_PREFIX = "scrypt$";

const makeToken = (user) => {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "";
  if (!secret) throw new Error("JWT_SECRET_MISSING");

  const email = String(user?.email || "").trim().toLowerCase();
  const role = String(user?.role || "traveler");
  const sub = String(user?._id || user?.id || "");

  if (!email) throw new Error("JWT_EMAIL_MISSING");

  return jwt.sign(
    { email, role },
    secret,
    {
      subject: sub || email,
      issuer: "iguideu-backend",
      audience: "iguideu-mobile",
      expiresIn: "7d"
    }
  );
};

const hashPassword = (plainPassword) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(plainPassword || ""), salt, 64).toString("hex");
  return `${PASSWORD_PREFIX}${salt}$${derived}`;
};

const verifyPassword = (plainPassword, storedPassword) => {
  const plain = String(plainPassword || "");
  const stored = String(storedPassword || "");

  if (!stored) return false;

  if (!stored.startsWith(PASSWORD_PREFIX)) {
    return stored === plain;
  }

  const parts = stored.split("$");
  if (parts.length !== 3) return false;

  const salt = parts[1];
  const savedHex = parts[2];

  try {
    const derivedHex = crypto.scryptSync(plain, salt, 64).toString("hex");
    const a = Buffer.from(savedHex, "hex");
    const b = Buffer.from(derivedHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

const publicUser = (user) => ({
  id: String(user?._id || ""),
  name: String(user?.name || ""),
  email: String(user?.email || ""),
  role: String(user?.role || "traveler"),
  phone: String(user?.phone || ""),
  lastName: String(user?.lastName || ""),
  country: String(user?.country || ""),
  city: String(user?.city || ""),
  language: String(user?.language || ""),
  travelStyle: String(user?.travelStyle || ""),
  interests: String(user?.interests || ""),
  about: String(user?.about || ""),
  bio: String(user?.bio || ""),
  photo: String(user?.photo || ""),
  emailVerified: Boolean(user?.emailVerified),
  emailVerifiedAt: user?.emailVerifiedAt || null,
  createdAt: user?.createdAt || null,
  updatedAt: user?.updatedAt || null
});

const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys")
);

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

const GOOGLE_AUDIENCES = [
  "661263042735-677bo9vuvgkds5g80h2phrn683rv3d88.apps.googleusercontent.com",
  "811938102755-r4acnclbtid8o2ac5jvvevh81dbt8rka.apps.googleusercontent.com"
];

async function verifyGoogleIdentityToken(identityToken) {
  const { payload } = await jwtVerify(identityToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: GOOGLE_AUDIENCES
  });

  if (!payload.email || payload.email_verified === false) {
    throw new Error("GOOGLE_EMAIL_NOT_VERIFIED");
  }

  return payload;
}

async function verifyAppleIdentityToken(identityToken) {
  const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
    issuer: "https://appleid.apple.com",
    audience: "com.auroragalactic.iguideu"
  });
  return payload;
}

function normalizeFullName(fullName) {
  if (fullName == null) return "";
  if (typeof fullName === "string") return String(fullName).trim();
  if (typeof fullName === "object") {
    return `${fullName.givenName || ""} ${fullName.familyName || ""}`.trim();
  }
  return "";
}

router.post("/google", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();

    if (!token) {
      return res.status(400).json({ ok: false, message: "TOKEN_REQUIRED" });
    }

    const decoded = await verifyGoogleIdentityToken(token);
    const email = String(decoded.email || "").trim().toLowerCase();
    const name = String(decoded.name || "Google User").trim();

    let user = await usersCollection().findOne({ email });

    if (!user) {
      const now = new Date();
      const result = await usersCollection().insertOne({
        name,
        email,
        password: "",
        role: "traveler",
        phone: "",
        emailVerified: true,
        emailVerifiedAt: now,
        createdAt: now,
        updatedAt: now
      });

      user = {
        _id: result.insertedId,
        name,
        email,
        role: "traveler"
      };
    }

    const sessionToken = makeToken(user);

    return res.json({
      ok: true,
      token: sessionToken,
      user: publicUser(user)
    });
  } catch {
    return res.status(401).json({ ok: false, message: "GOOGLE_INVALID_TOKEN" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const email = String(req.user?.email || "").trim().toLowerCase();

    const user = await usersCollection().findOne({ email });

    if (!user) {
      return res.status(404).json({ ok: false, message: "USER_NOT_FOUND" });
    }

    return res.json({
      ok: true,
      user: publicUser(user)
    });
  } catch {
    return res.status(500).json({ ok: false, message: "ME_ERROR" });
  }
});

router.put("/me", requireAuth, async (req, res) => {
  try {
    const email = String(req.user?.email || "").trim().toLowerCase();

    const update = {
      name: String(req.body?.name || "").trim(),
      lastName: String(req.body?.lastName || "").trim(),
      country: String(req.body?.country || "").trim(),
      city: String(req.body?.city || "").trim(),
      language: String(req.body?.language || "").trim(),
      phone: String(req.body?.phone || "").trim(),
      travelStyle: String(req.body?.travelStyle || "").trim(),
      interests: String(req.body?.interests || "").trim(),
      about: String(req.body?.about || "").trim(),
      bio: String(req.body?.about || req.body?.bio || "").trim(),
      photo: String(req.body?.photo || "").trim(),
      updatedAt: new Date()
    };

    await usersCollection().updateOne(
      { email },
      { $set: update }
    );

    const user = await usersCollection().findOne({ email });

    return res.json({
      ok: true,
      user: publicUser(user)
    });
  } catch {
    return res.status(500).json({ ok: false, message: "UPDATE_ERROR" });
  }
});

router.post("/apple", async (req, res) => {
  try {
    const identityToken = req.body?.identityToken;
    const bodyEmail = req.body?.email;
    const fullName = req.body?.fullName;

    if (!identityToken) {
      return res
        .status(400)
        .json({ ok: false, message: "APPLE_IDENTITY_TOKEN_REQUIRED" });
    }

    const decoded = await verifyAppleIdentityToken(identityToken);
    const email = String(decoded.email || bodyEmail || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({ ok: false, message: "APPLE_EMAIL_REQUIRED" });
    }

    let user = await usersCollection().findOne({ email });

    if (!user) {
      const now = new Date();
      const nameFromBody = normalizeFullName(fullName);
      const name = nameFromBody || email;

      const result = await usersCollection().insertOne({
        name,
        email,
        password: "",
        role: "traveler",
        phone: "",
        emailVerified: true,
        emailVerifiedAt: now,
        createdAt: now,
        updatedAt: now
      });

      user = {
        _id: result.insertedId,
        name,
        email,
        password: "",
        role: "traveler",
        phone: "",
        emailVerified: true,
        emailVerifiedAt: now,
        createdAt: now,
        updatedAt: now
      };
    }

    const token = makeToken(user);

    return res.json({
      ok: true,
      token,
      user: publicUser(user)
    });
  } catch {
    return res.status(401).json({ ok: false, message: "APPLE_INVALID_TOKEN" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ ok: false, message: "EMAIL_AND_PASSWORD_REQUIRED" });
    }

    const user = await usersCollection().findOne({ email });

    if (!user) return res.status(401).json({ ok: false, message: "INVALID_CREDENTIALS" });

    const valid = verifyPassword(password, user.password);

    if (!valid) return res.status(401).json({ ok: false, message: "INVALID_CREDENTIALS" });

    const token = makeToken(user);

    return res.json({
      ok: true,
      token,
      user: publicUser(user)
    });
  } catch {
    return res.status(500).json({ ok: false, message: "LOGIN_ERROR" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, message: "NAME_EMAIL_PASSWORD_REQUIRED" });
    }

    const exists = await usersCollection().findOne({ email });

    if (exists) {
      return res.status(409).json({ ok: false, message: "EMAIL_ALREADY_EXISTS" });
    }

    const now = new Date();

    // Captura quirúrgica del rol solicitado
    const requestedRole = String(req.body?.role || "traveler").trim().toLowerCase();
    const role = requestedRole === "guide" ? "guide" : "traveler";

    const result = await usersCollection().insertOne({
      name,
      email,
      password: hashPassword(password),
      role,
      createdAt: now,
      updatedAt: now
    });

    const token = makeToken({
      _id: result.insertedId,
      email,
      role
    });

    return res.status(201).json({
      ok: true,
      token,
      user: {
        id: String(result.insertedId),
        name,
        email,
        role
      }
    });
  } catch {
    return res.status(500).json({ ok: false, message: "REGISTER_ERROR" });
  }
});
const authRateLimitStore = new Map();

function authRateLimit({ windowMs = 15 * 60 * 1000, max = 5 } = {}) {
  return (req, res, next) => {
    const ip = String(
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown"
    )
      .split(",")[0]
      .trim();

    const now = Date.now();
    const key = `${ip}:${req.path}`;

    const current = authRateLimitStore.get(key) || {
      count: 0,
      resetAt: now + windowMs,
    };

    if (now > current.resetAt) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }

    current.count += 1;
    authRateLimitStore.set(key, current);

    if (current.count > max) {
      return res.status(429).json({
        ok: false,
        error: "TOO_MANY_REQUESTS",
      });
    }

    next();
  };
}

const forgotPasswordLimiter = authRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
});

const resetPasswordLimiter = authRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

const resetTokens = new Map();

async function sendPasswordResetEmail(to, token) {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  if (!resend) {
    console.log("RESEND_NOT_CONFIGURED");
    return false;
  }

  const text = [
    "Tu código de recuperación de I GUIDE U es: " + token,
    "",
    "Este código vence en 30 minutos.",
    "",
    "Si no pediste recuperar tu contraseña, ignorá este email."
  ].join("\n");

  const html =
    '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">' +
    "<h2>I GUIDE U</h2>" +
    "<p>Tu código de recuperación es:</p>" +
    '<p style="font-size:22px;font-weight:700;letter-spacing:1px">' + token + "</p>" +
    "<p>Este código vence en 30 minutos.</p>" +
    "<p>Si no pediste recuperar tu contraseña, ignorá este email.</p>" +
    "</div>";

  const resendResult = await resend.emails.send({
    from: process.env.MAIL_FROM || "I GUIDE U <onboarding@resend.dev>",
    to,
    subject: "I GUIDE U - Recuperar contraseña",
    text,
    html
  });

  return !resendResult.error;
}

router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "EMAIL_REQUIRED" });
    }

    const user = await usersCollection().findOne({ email });

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
      emailSent
    });
  } catch (err) {
    console.error("FORGOT_PASSWORD_ERROR", err);
    return res.status(500).json({ ok: false, error: "FORGOT_PASSWORD_FAILED" });
  }
});

router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
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

    const hashedPassword = hashPassword(password);

    const result = await usersCollection().updateOne(
      { _id: new mongoose.Types.ObjectId(entry.userId) },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date()
        }
      }
    );

    resetTokens.delete(token);

    if (!result.matchedCount) {
      return res.status(400).json({ ok: false, error: "TOKEN_INVALID_OR_EXPIRED" });
    }

    return res.json({ ok: true, message: "Password updated." });
  } catch (err) {
    console.error("RESET_PASSWORD_ERROR", err);
    return res.status(500).json({ ok: false, error: "RESET_PASSWORD_FAILED" });
  }
});


export default router;
