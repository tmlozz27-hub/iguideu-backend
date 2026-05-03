import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

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
    const email = String(req.body?.email || "").trim().toLowerCase();
    const name = String(req.body?.name || "Google User").trim();

    if (!token) {
      return res.status(400).json({ ok: false, message: "TOKEN_REQUIRED" });
    }

    if (!email) {
      return res.status(400).json({ ok: false, message: "EMAIL_REQUIRED" });
    }

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
        email
      };
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

router.get("/me", async (req, res) => {
  try {
    const email = getEmailFromToken(req.headers.authorization);

    if (!email) {
      return res.status(401).json({ ok: false, message: "AUTH_REQUIRED" });
    }

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

router.put("/me", async (req, res) => {
  try {
    const email = getEmailFromToken(req.headers.authorization);

    if (!email) {
      return res.status(401).json({ ok: false, message: "AUTH_REQUIRED" });
    }

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

    const token = makeToken(email);

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

    const result = await usersCollection().insertOne({
      name,
      email,
      password: hashPassword(password),
      role: "traveler",
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
        role: "traveler"
      }
    });
  } catch {
    return res.status(500).json({ ok: false, message: "REGISTER_ERROR" });
  }
});

export default router;
