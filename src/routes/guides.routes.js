import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";

const router = express.Router();

const PASSWORD_PREFIX = "scrypt$";

const hashPassword = (plainPassword) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .scryptSync(String(plainPassword || ""), salt, 64)
    .toString("hex");

  return `${PASSWORD_PREFIX}${salt}$${derived}`;
};

const getEmailFromToken = (authHeader) => {
  const raw = String(authHeader || "").trim();

  if (!raw.toLowerCase().startsWith("bearer ")) return "";

  const token = raw.slice(7).trim();

  if (!token.startsWith("DEV_TOKEN_")) return "";

  const encoded = token.replace("DEV_TOKEN_", "");

  try {
    return Buffer.from(encoded, "base64")
      .toString("utf8")
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
};

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function extractLatLng(doc) {
  const candidates = [
    [doc?.location?.lat, doc?.location?.lng],
    [doc?.location?.latitude, doc?.location?.longitude],
    [doc?.coordinates?.lat, doc?.coordinates?.lng],
    [doc?.coordinates?.latitude, doc?.coordinates?.longitude],
    [doc?.lat, doc?.lng],
    [doc?.latitude, doc?.longitude]
  ];

  for (const [a, b] of candidates) {
    const lat = Number(a);
    const lng = Number(b);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  return null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));

  return R * c;
}

router.get("/me", async (req, res) => {
  try {
    const db = mongoose.connection?.db;

    if (!db) {
      return res
        .status(500)
        .json({ ok: false, error: "Mongo not connected" });
    }

    const userEmail = getEmailFromToken(req.headers.authorization);

    if (!userEmail) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED"
      });
    }

    const col = db.collection("guides");

    const guide = await col.findOne({
      email: userEmail
    });

    if (!guide) {
      return res.status(404).json({
        ok: false,
        error: "GUIDE_NOT_FOUND"
      });
    }

    return res.json({
      ok: true,
      item: guide
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "guide me error"
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const db = mongoose.connection?.db;

    if (!db) {
      return res.status(500).json({
        error: "Mongo not connected"
      });
    }

    const col = db.collection("guides");

    const count = await col.countDocuments();

    const query =
      count > 0
        ? {
            $or: [
              { active: true },
              { active: { $exists: false } }
            ]
          }
        : {};

    const docs = await col
      .find(query)
      .sort({
        updatedAt: -1,
        createdAt: -1
      })
      .limit(200)
      .toArray();

    return res.json(docs);
  } catch (e) {
    return res.status(500).json({
      error: e?.message || "guides error"
    });
  }
});

router.get("/nearby", async (req, res) => {
  try {
    const db = mongoose.connection?.db;

    if (!db) {
      return res.status(500).json({
        error: "Mongo not connected"
      });
    }

    const lat = toNumber(req.query.lat);
    const lng = toNumber(req.query.lng);
    const radiusKm = toNumber(req.query.radius, 50);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        error: "lat and lng are required numeric query params"
      });
    }

    const col = db.collection("guides");

    const count = await col.countDocuments();

    const query =
      count > 0
        ? {
            $or: [
              { active: true },
              { active: { $exists: false } }
            ]
          }
        : {};

    const docs = await col
      .find(query)
      .sort({
        updatedAt: -1,
        createdAt: -1
      })
      .limit(500)
      .toArray();

    const nearby = docs
      .map((doc) => {
        const point = extractLatLng(doc);

        if (!point) return null;

        const distanceKm = haversineKm(
          lat,
          lng,
          point.lat,
          point.lng
        );

        return {
          ...doc,
          distanceKm: Number(distanceKm.toFixed(2)),
          geo: {
            lat: point.lat,
            lng: point.lng
          }
        };
      })
      .filter(Boolean)
      .filter((doc) => doc.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 200);

    return res.json({
      ok: true,
      center: { lat, lng },
      radiusKm,
      count: nearby.length,
      items: nearby
    });
  } catch (e) {
    return res.status(500).json({
      error: e?.message || "guides nearby error"
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const db = mongoose.connection?.db;

    if (!db) {
      return res.status(500).json({
        error: "Mongo not connected"
      });
    }

    const {
      name,
      email,
      phone,
      city,
      country,
      bio,
      languages,
      priceHour,
      priceDay,
      price24h,
      active,
      password
    } = req.body || {};

    const cleanPassword = String(password || "").trim();

    if (!name || !email || !city || !country || !cleanPassword) {
      return res.status(400).json({
        error: "MISSING_REQUIRED_FIELDS"
      });
    }

    const cleanEmail = String(email)
      .trim()
      .toLowerCase();

    const usersCol = db.collection("users");

    const existingUser = await usersCol.findOne({
      email: cleanEmail
    });

    if (existingUser) {
      return res.status(409).json({
        ok: false,
        error: "EMAIL_ALREADY_EXISTS"
      });
    }

    const now = new Date();

    await usersCol.insertOne({
      name: String(name).trim(),
      email: cleanEmail,
      password: hashPassword(cleanPassword),
      role: "guide",
      phone: phone ? String(phone).trim() : "",
      city: city ? String(city).trim() : "",
      country: country ? String(country).trim() : "",
      bio: bio ? String(bio).trim() : "",
      createdAt: now,
      updatedAt: now
    });

    const guidesCol = db.collection("guides");

    const doc = {
      name: String(name).trim(),
      email: cleanEmail,
      phone: phone ? String(phone).trim() : "",
      city: String(city).trim(),
      country: String(country).trim(),
      bio: bio ? String(bio).trim() : "",
      languages: languages ? String(languages).trim() : "",
      priceHour: Number(priceHour) || 0,
      priceDay: Number(priceDay) || 0,
      price24h: Number(price24h) || 0,
      active: active !== false,
      createdAt: now,
      updatedAt: now
    };

    const result = await guidesCol.insertOne(doc);

    return res.json({
      ok: true,
      insertedId: result.insertedId,
      item: {
        _id: result.insertedId,
        ...doc
      }
    });
  } catch (e) {
    return res.status(500).json({
      error: e?.message || "create guide error"
    });
  }
});

export default router;