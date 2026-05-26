import express from "express";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

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
      return res.status(500).json({
        ok: false,
        error: "Mongo not connected"
      });
    }

    const userEmail = String(req.user?.email || "")
      .trim()
      .toLowerCase();

    if (!userEmail) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED"
      });
    }

    const col = db.collection("guides");

    const guide =
      (await col.findOne({ userEmail })) ||
      (await col.findOne({ email: userEmail }));

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

router.post("/", requireAuth, async (req, res) => {
  try {
    const db = mongoose.connection?.db;

    if (!db) {
      return res.status(500).json({
        error: "Mongo not connected"
      });
    }

    const userEmail = String(req.user?.email || "")
      .trim()
      .toLowerCase();

    if (!userEmail) {
      return res.status(401).json({
        error: "UNAUTHORIZED"
      });
    }

    const {
      name,
      phone,
      city,
      country,
      bio,
      languages,
      priceHour,
      priceDay,
      price24h,
      active
    } = req.body || {};

    if (!name || !city || !country) {
      return res.status(400).json({
        error: "MISSING_REQUIRED_FIELDS"
      });
    }

    const col = db.collection("guides");

    const existing = await col.findOne({
      $or: [
        { userEmail },
        { email: userEmail }
      ]
    });

    const doc = {
      name: String(name).trim(),
      email: userEmail,
      userEmail,
      phone: phone ? String(phone).trim() : "",
      city: String(city).trim(),
      country: String(country).trim(),
      bio: bio ? String(bio).trim() : "",
      languages: languages ? String(languages).trim() : "",
      priceHour: Number(priceHour) || 0,
      priceDay: Number(priceDay) || 0,
      price24h: Number(price24h) || 0,
      active: active !== false,
      updatedAt: new Date()
    };

    if (existing) {
      await col.updateOne(
        { _id: existing._id },
        {
          $set: doc
        }
      );

      return res.json({
        ok: true,
        updated: true,
        item: {
          ...existing,
          ...doc
        }
      });
    }

    doc.createdAt = new Date();

    const result = await col.insertOne(doc);

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