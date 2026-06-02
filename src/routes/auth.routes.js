import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";

const router = express.Router();

const usersCollection = () => mongoose.connection.db.collection("users");

const PASSWORD_PREFIX = "scrypt$";

const getEmailFromToken = (authHeader) => {
  const raw = String(authHeader || "").trim();
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  const token = raw.slice(7).trim();
  if (!token.startsWith("DEV_TOKEN_")) return "";
  const encoded = token.replace("DEV_TOKEN_", "");
  try {
    return Buffer.from(encoded, "base64").toString("utf8").trim().toLowerCase();
  } catch {
    return "";
  }
};

const makeToken = (email) => {
  return "DEV_TOKEN_" + Buffer.from(String(email || "").trim().toLowerCase()).toString("base64");
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
  id: String(user._id),
  name: String(user.name || ""),
  email: String(user.email || ""),
  role: String(user.role || "traveler"),
  phone: String(user.phone || ""),
  emailVerified: Boolean(user.emailVerified),
  emailVerifiedAt: user.emailVerifiedAt || null,
  createdAt: user.createdAt || null,
  updatedAt: user.updatedAt || null
});


// 🟢 NUEVO: GOOGLE LOGIN
router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ ok: false, message: "TOKEN_REQUIRED" });
    }

    // 🔥 temporal: generamos usuario por email fijo
    const email = "googleuser@iguideu.app";

    let user = await usersCollection().findOne({ email });

    if (!user) {
      const now = new Date();
      const result = await usersCollection().insertOne({
        name: "Google User",
        email,
        password: "",
        role: "traveler",
        phone: "",
        emailVerified: true,
        emailVerifiedAt: now,
        createdAt: now,
        updatedAt: now
      });

      user = { _id: result.insertedId, name: "Google User", email };
    }

    const jwt = makeToken(email);

    return res.json({
      ok: true,
      token: jwt,
      user: publicUser(user)
    });
  } catch {
    return res.status(500).json({ ok: false, message: "GOOGLE_ERROR" });
  }
});


// 🟢 LOGIN NORMAL
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

    const token = makeToken(email);

    return res.json({
      ok: true,
      token,
      user: publicUser(user)
    });
  } catch {
    return res.status(500).json({ ok: false, message: "LOGIN_ERROR" });
  }
});


// 🟢 REGISTER
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

    const token = makeToken(email);

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

export default router;