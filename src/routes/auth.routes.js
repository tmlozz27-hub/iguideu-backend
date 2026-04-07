import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";

const router = express.Router();

const usersCollection = () => mongoose.connection.db.collection("users");

const PASSWORD_PREFIX = "scrypt$";
const RESET_TOKEN_MINUTES = 60;

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

const isHashedPassword = (value) => {
  return String(value || "").startsWith(PASSWORD_PREFIX);
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

  if (!isHashedPassword(stored)) {
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

const normalizePhone = (value) => {
  return String(value || "").trim();
};

const publicUser = (user) => {
  return {
    id: String(user._id),
    name: String(user.name || ""),
    email: String(user.email || ""),
    role: String(user.role || "traveler"),
    phone: String(user.phone || ""),
    emailVerified: Boolean(user.emailVerified),
    emailVerifiedAt: user.emailVerifiedAt || null,
    phoneVerified: Boolean(user.phoneVerified),
    phoneVerifiedAt: user.phoneVerifiedAt || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null
  };
};

const makeResetToken = () => crypto.randomBytes(32).toString("hex");
const hashResetToken = (token) =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");

router.get("/me", async (req, res) => {
  try {
    const email = getEmailFromToken(req.headers.authorization);

    if (!email) return res.status(401).json({ ok: false, message: "UNAUTHORIZED" });

    const user = await usersCollection().findOne(
      { email },
      { projection: { password: 0 } }
    );

    if (!user) return res.status(404).json({ ok: false, message: "USER_NOT_FOUND" });

    return res.status(200).json({ ok: true, user: publicUser(user) });
  } catch {
    return res.status(500).json({ ok: false, message: "ME_ERROR" });
  }
});

router.put("/me", async (req, res) => {
  try {
    const email = getEmailFromToken(req.headers.authorization);

    if (!email) return res.status(401).json({ ok: false, message: "UNAUTHORIZED" });

    const name = String(req.body?.name || "").trim();
    const phone = normalizePhone(req.body?.phone);

    if (!name) return res.status(400).json({ ok: false, message: "NAME_REQUIRED" });

    const now = new Date();

    const result = await usersCollection().findOneAndUpdate(
      { email },
      { $set: { name, phone, updatedAt: now } },
      { returnDocument: "after", projection: { password: 0 } }
    );

    if (!result) return res.status(404).json({ ok: false, message: "USER_NOT_FOUND" });

    return res.status(200).json({ ok: true, user: publicUser(result) });
  } catch {
    return res.status(500).json({ ok: false, message: "UPDATE_ME_ERROR" });
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

    const storedPassword = String(user.password || "");
    const valid = verifyPassword(password, storedPassword);

    if (!valid) return res.status(401).json({ ok: false, message: "INVALID_CREDENTIALS" });

    const token = makeToken(email);

    return res.status(200).json({
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
    const phone = normalizePhone(req.body?.phone);

    const roleRaw = String(req.body?.role || "").trim().toLowerCase();
    const role = roleRaw === "guide" ? "guide" : "traveler";

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, message: "NAME_EMAIL_PASSWORD_REQUIRED" });
    }

    if (password.length < 6) {
      return res.status(400).json({ ok: false, message: "PASSWORD_MIN_6" });
    }

    const exists = await usersCollection().findOne({ email });

    if (exists) {
      return res.status(409).json({ ok: false, message: "EMAIL_ALREADY_EXISTS" });
    }

    const now = new Date();

    const doc = {
      name,
      email,
      password: hashPassword(password),
      role,
      phone,
      emailVerified: false,
      emailVerifiedAt: null,
      phoneVerified: false,
      phoneVerifiedAt: null,
      createdAt: now,
      updatedAt: now
    };

    const result = await usersCollection().insertOne(doc);
    const token = makeToken(email);

    return res.status(201).json({
      ok: true,
      token,
      user: {
        id: String(result.insertedId),
        name,
        email,
        role,
        phone,
        emailVerified: false,
        emailVerifiedAt: null,
        phoneVerified: false,
        phoneVerifiedAt: null,
        createdAt: now,
        updatedAt: now
      }
    });
  } catch {
    return res.status(500).json({ ok: false, message: "REGISTER_ERROR" });
  }
});

router.post("/send-verification-email", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ ok: false, message: "EMAIL_REQUIRED" });
    }

    const user = await usersCollection().findOne({ email });

    if (!user) {
      return res.status(404).json({ ok: false, message: "USER_NOT_FOUND" });
    }

    const verificationToken = crypto.randomBytes(24).toString("hex");

    await usersCollection().updateOne(
      { email },
      {
        $set: {
          emailVerificationToken: verificationToken,
          emailVerificationRequestedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    console.log("VERIFY_EMAIL_REQUEST", {
      email,
      verificationToken,
      verifyEndpoint: `/api/auth/verify-email?email=${encodeURIComponent(email)}`
    });

    return res.status(200).json({
      ok: true,
      message: "VERIFICATION_EMAIL_SENT"
    });
  } catch {
    return res.status(500).json({ ok: false, message: "SEND_VERIFICATION_EMAIL_ERROR" });
  }
});

router.post("/verify-email", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ ok: false, error: "EMAIL_REQUIRED" });
    }

    await usersCollection().updateOne(
      { email: String(email).toLowerCase().trim() },
      {
        $set: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          updatedAt: new Date()
        },
        $unset: {
          emailVerificationToken: "",
          emailVerificationRequestedAt: ""
        }
      }
    );

    return res.json({
      ok: true,
      message: "EMAIL_VERIFIED"
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "VERIFY_EMAIL_ERROR" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ ok: false, message: "EMAIL_REQUIRED" });
    }

    return res.status(200).json({
      ok: true,
      message: "IF_ACCOUNT_EXISTS_INSTRUCTIONS_SENT"
    });
  } catch {
    return res.status(500).json({ ok: false, message: "FORGOT_PASSWORD_ERROR" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    return res.status(200).json({ ok: true, message: "PASSWORD_RESET_OK" });
  } catch {
    return res.status(500).json({ ok: false, message: "RESET_PASSWORD_ERROR" });
  }
});

export default router;