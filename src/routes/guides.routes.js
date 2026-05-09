import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const PASSWORD_PREFIX = "scrypt$";

const hashPassword = (plainPassword) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .scryptSync(String(plainPassword || ""), salt, 64)
    .toString("hex");

  return `${PASSWORD_PREFIX}${salt}$${derived}`;
};

function authEmail(req) {
  return String(req.user?.email || "").trim().toLowerCase();
}

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

router.get("/me", requireAuth, async (req, res) => {
  try {
    const db = mongoose.connection?.db;

    if (!db) {
      return res
        .status(500)
        .json({ ok: false, error: "Mongo not connected" });
    }

    const userEmail = authEmail(req);

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

async function updateGuideMe(req, res) {
  try {
    const db = mongoose.connection?.db;

    if (!db) {
      return res.status(500).json({ ok: false, error: "Mongo not connected" });
    }

    const userEmail = authEmail(req);

    if (!userEmail) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const guidesCol = db.collection("guides");
    const usersCol = db.collection("users");

    const guide = await guidesCol.findOne({ email: userEmail });

    if (!guide) {
      return res.status(404).json({ ok: false, error: "GUIDE_NOT_FOUND" });
    }

    const b = req.body || {};
    const set = {};
    const now = new Date();

    if (b.name !== undefined) set.name = String(b.name || "").trim();
    if (b.phone !== undefined) set.phone = String(b.phone || "").trim();
    if (b.city !== undefined) set.city = String(b.city || "").trim();
    if (b.country !== undefined) set.country = String(b.country || "").trim();
    if (b.bio !== undefined) set.bio = String(b.bio || "").trim();
    if (b.languages !== undefined) set.languages = String(b.languages || "").trim();
    if (b.photo !== undefined) set.photo = String(b.photo || "").trim();
    if (b.mediaDraft !== undefined) set.mediaDraft = b.mediaDraft;

    if (b.priceHour !== undefined) {
      const n = Number(b.priceHour);
      if (Number.isFinite(n)) set.priceHour = n;
    }
    if (b.priceDay !== undefined) {
      const n = Number(b.priceDay);
      if (Number.isFinite(n)) set.priceDay = n;
    }
    if (b.price24h !== undefined) {
      const n = Number(b.price24h);
      if (Number.isFinite(n)) set.price24h = n;
    }

    if (b.active !== undefined) {
      set.active = Boolean(b.active);
    }

    const pwd = String(b.password ?? "").trim();
    let passwordUpdated = false;

    if (pwd) {
      await usersCol.updateOne(
        { email: userEmail },
        { $set: { password: hashPassword(pwd), updatedAt: now } }
      );
      passwordUpdated = true;
    }

    if (Object.keys(set).length === 0 && !passwordUpdated) {
      return res.status(400).json({ ok: false, error: "NO_FIELDS_TO_UPDATE" });
    }

    if (Object.keys(set).length > 0) {
      set.updatedAt = now;
      await guidesCol.updateOne({ email: userEmail }, { $set: set });
    }

    const updated = await guidesCol.findOne({ email: userEmail });

    return res.json({
      ok: true,
      item: updated
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "guide update error"
    });
  }
}

router.patch("/me", requireAuth, updateGuideMe);
router.put("/me", requireAuth, updateGuideMe);

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
    const createSecret = String(process.env.GUIDE_CREATE_SECRET || "").trim();
    const headerSecret = String(req.headers["x-guide-create-secret"] || "").trim();

    if (!createSecret) {
      return res.status(503).json({ ok: false, message: "GUIDE_CREATE_DISABLED" });
    }

    if (!headerSecret || headerSecret !== createSecret) {
      return res.status(403).json({ ok: false, message: "GUIDE_CREATE_FORBIDDEN" });
    }

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