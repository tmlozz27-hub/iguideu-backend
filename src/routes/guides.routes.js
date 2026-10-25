import { reserveUniqueGuideBankAccount, releaseUniqueGuideBankAccount, confirmUniqueGuideBankAccount } from "../services/airwallex/guide-bank-unique.js";
import { releaseGuideBeneficiaryClaim } from "../services/airwallex/guide-beneficiary-release.js";
import { linkAirwallexBeneficiaryToGuide } from "../services/airwallex/guide-beneficiary-link.js";
import { recordCreatedAirwallexBeneficiary } from "../services/airwallex/guide-beneficiary-recovery.js";
import { claimGuideBeneficiaryOnboarding } from "../services/airwallex/guide-beneficiary-claim.js";
import { getAirwallexLiveBeneficiarySchema } from "../services/airwallex/beneficiary-schema-live.js";
import express from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import Stripe from "stripe";
import { requireAuth } from "../middleware/auth.js";
import {
  validateAirwallexLiveBeneficiary,
  createAirwallexLiveBeneficiary
} from "../services/airwallex/beneficiary-live.js";

const router = express.Router();

const STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET ||
  "";

let stripe = null;

if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY);
}

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

router.post("/me/connect/onboarding", requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        ok: false,
        error: "STRIPE_NOT_CONFIGURED"
      });
    }

    const db = mongoose.connection?.db;

    if (!db) {
      return res.status(500).json({
        ok: false,
        error: "Mongo not connected"
      });
    }

    const email = authEmail(req);

    if (!email) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED"
      });
    }

    const guidesCol = db.collection("guides");
    const guide = await guidesCol.findOne({ email });

    if (!guide) {
      return res.status(404).json({
        ok: false,
        error: "GUIDE_NOT_FOUND"
      });
    }

    let accountId = guide?.stripeConnect?.accountId || null;

    if (!accountId) {
      const account = await stripe.accounts.create(
        {
          email,
          controller: {
            fees: {
              payer: "application"
            },
            losses: {
              payments: "application"
            },
            stripe_dashboard: {
              type: "express"
            }
          },
          capabilities: {
            transfers: {
              requested: true
            }
          },
          metadata: {
            guideId: String(guide._id),
            guideEmail: email
          }
        },
        {
          idempotencyKey: `guide-connect-account-${guide._id}-v2`
        }
      );

      accountId = account.id;

      await guidesCol.updateOne(
        { _id: guide._id },
        {
          $set: {
            "stripeConnect.accountId": accountId,
            "stripeConnect.onboardingComplete": false,
            "stripeConnect.chargesEnabled": Boolean(account.charges_enabled),
            "stripeConnect.payoutsEnabled": Boolean(account.payouts_enabled),
            "stripeConnect.country": account.country || "",
            "stripeConnect.currency": account.default_currency || ""
          }
        }
      );
    }

    const refreshUrl =
      process.env.STRIPE_CONNECT_REFRESH_URL ||
      "https://www.i-guide-u.com/connect/refresh";

    const returnUrl =
      process.env.STRIPE_CONNECT_RETURN_URL ||
      "https://www.i-guide-u.com/connect/return";

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
      collection_options: {
        fields: "eventually_due"
      }
    });

    return res.json({
      ok: true,
      accountId,
      onboardingUrl: accountLink.url
    });
  } catch (e) {
    console.error("stripe connect onboarding error", { message: e?.message || "", name: e?.name || "", code: e?.code || "" });

    return res.status(500).json({
      ok: false,
      error: e?.message || "STRIPE_CONNECT_ONBOARDING_ERROR"
    });
  }
});
router.post("/me/connect/sync", requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        ok: false,
        error: "STRIPE_NOT_CONFIGURED"
      });
    }

    const db = mongoose.connection?.db;

    if (!db) {
      return res.status(500).json({
        ok: false,
        error: "Mongo not connected"
      });
    }

    const email = authEmail(req);

    if (!email) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED"
      });
    }

    const guidesCol = db.collection("guides");
    const guide = await guidesCol.findOne({ email });

    if (!guide) {
      return res.status(404).json({
        ok: false,
        error: "GUIDE_NOT_FOUND"
      });
    }

    const accountId = guide?.stripeConnect?.accountId || "";

    if (!accountId) {
      return res.status(400).json({
        ok: false,
        error: "STRIPE_CONNECT_ACCOUNT_MISSING"
      });
    }

    const account = await stripe.accounts.retrieve(accountId);

    const currentlyDue = Array.isArray(account?.requirements?.currently_due)
      ? account.requirements.currently_due
      : [];

    const onboardingComplete =
      Boolean(account.details_submitted) &&
      currentlyDue.length === 0;

    const stripeConnect = {
      accountId,
      onboardingComplete,
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      country: account.country || "",
      currency: account.default_currency || ""
    };

    await guidesCol.updateOne(
      { _id: guide._id },
      {
        $set: {
          "stripeConnect.accountId": stripeConnect.accountId,
          "stripeConnect.onboardingComplete": stripeConnect.onboardingComplete,
          "stripeConnect.chargesEnabled": stripeConnect.chargesEnabled,
          "stripeConnect.payoutsEnabled": stripeConnect.payoutsEnabled,
          "stripeConnect.country": stripeConnect.country,
          "stripeConnect.currency": stripeConnect.currency
        }
      }
    );

    return res.json({
      ok: true,
      stripeConnect
    });
  } catch (e) {
    console.error("stripe connect sync error", { message: e?.message || "", name: e?.name || "", code: e?.code || "" });

    return res.status(500).json({
      ok: false,
      error: e?.message || "STRIPE_CONNECT_SYNC_ERROR"
    });
  }
});
router.post("/me/airwallex/schema", requireAuth, async (req, res) => { if (req.user?.role !== "guide") return res.status(403).json({ ok: false, error: "GUIDE_ONLY" });
  try {
    const email = authEmail(req);

    if (!email) {
      return res.status(401).json({
        ok: false,
        error: "GUIDE_AUTH_REQUIRED"
      });
    }

    const db = mongoose.connection?.db;

    if (!db) {
      return res.status(503).json({
        ok: false,
        error: "DATABASE_UNAVAILABLE"
      });
    }

    const guide = await db.collection("guides").findOne({ email });

    if (!guide) {
      return res.status(403).json({
        ok: false,
        error: "GUIDE_PROFILE_REQUIRED"
      });
    }

    const input = req.body || {};

    const schema = await getAirwallexLiveBeneficiarySchema({
      bankCountryCode: input.bankCountryCode,
      accountCurrency: input.accountCurrency,
      entityType: input.entityType,
      transferMethod: input.transferMethod
    });

    return res.json({
      ok: true,
      schema
    });
  } catch (error) {
    console.error("AIRWALLEX_SCHEMA_ERROR", error.message);

    return res.status(400).json({
      ok: false,
      error: "AIRWALLEX_SCHEMA_UNAVAILABLE"
    });
  }
});

router.post("/me/airwallex/onboarding", requireAuth, async (req, res) => { if (req.user?.role !== "guide") return res.status(403).json({ ok: false, error: "GUIDE_ONLY" });
  try {
    if (process.env.AIRWALLEX_ENV !== "live") {
      return res.status(503).json({ ok: false, error: "AIRWALLEX_LIVE_ONLY" });
    }

    const db = mongoose.connection?.db;

    if (!db) {
      return res.status(500).json({ ok: false, error: "Mongo not connected" });
    }

    const email = authEmail(req);

    if (!email) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const guidesCol = db.collection("guides");
    const guide = await guidesCol.findOne({ email });

    if (!guide) {
      return res.status(404).json({ ok: false, error: "GUIDE_NOT_FOUND" });
    }

    if (
      guide.airwallex?.beneficiaryVerified === true ||
      String(guide.airwallex?.beneficiaryId || "").trim()
    ) {
      return res.status(409).json({
        ok: false,
        error: "AIRWALLEX_BENEFICIARY_ALREADY_EXISTS"
      });
    }

    if (
      guide.airwallex?.onboardingClaimId ||
      guide.airwallex?.onboardingCreatedBeneficiaryId
    ) {
      return res.status(409).json({
        ok: false,
        error: "AIRWALLEX_ONBOARDING_REVIEW_REQUIRED",
        retryAllowed: false
      });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const schemaInput = body.schemaInput;
    const beneficiary = body.beneficiary;

    if (
      !schemaInput ||
      (schemaInput.accountType && !["SAVINGS", "CHECKING"].includes(schemaInput.accountType))
    ) {
      return res.status(400).json({
        ok: false,
        error: "BANK_ACCOUNT_TYPE_INVALID"
      });
    }


    if (
      !schemaInput ||
      typeof schemaInput !== "object" ||
      !beneficiary ||
      typeof beneficiary !== "object"
    ) {
      return res.status(400).json({
        ok: false,
        error: "AIRWALLEX_BENEFICIARY_DATA_REQUIRED"
      });
    }

    if (process.env.AIRWALLEX_LIVE_BENEFICIARIES_ENABLED !== "true") {
      return res.status(503).json({
        ok: false,
        error: "AIRWALLEX_LIVE_BENEFICIARIES_DISABLED"
      });
    }
    if (process.env.BANK_ACCOUNT_UNIQUENESS_READY !== "true") {
      return res.status(503).json({
        ok: false,
        error: "BANK_ACCOUNT_UNIQUENESS_NOT_READY"
      });
    }
    const externalIdentifier = `IGUIDEU-GUIDE-${String(guide._id)}`;
    const claimId = await claimGuideBeneficiaryOnboarding(
      guidesCol,
      email,
      schemaInput
    );

    let bankFingerprint;

    try {
      bankFingerprint = await reserveUniqueGuideBankAccount(
        guidesCol,
        guide._id,
        beneficiary
      );
    } catch (bankError) {
      await releaseGuideBeneficiaryClaim(guidesCol, email, claimId);

      if (bankError.message === "BANK_ACCOUNT_ALREADY_REGISTERED") {
        return res.status(409).json({
          ok: false,
          error: "BANK_ACCOUNT_ALREADY_REGISTERED"
        });
      }

      throw bankError;
    }

    try {
      await validateAirwallexLiveBeneficiary({
        schemaInput,
        beneficiary,
        externalIdentifier
      });
    } catch (validationError) {
      const localValidationErrors = new Set([
        "AIRWALLEX_BENEFICIARY_DATA_REQUIRED",
        "AIRWALLEX_ONBOARDING_SCHEMA_REQUIRED",
          "AIRWALLEX_BENEFICIARY_TYPE_INVALID",
          "AIRWALLEX_TRANSFER_METHOD_INVALID"
      ]);

      if (
        localValidationErrors.has(validationError?.message) ||
        (
          validationError?.operation === "BENEFICIARY_VALIDATE" &&
          validationError?.httpStatus === 400
        )
      ) {
        await releaseUniqueGuideBankAccount(
          guidesCol,
          guide._id,
          bankFingerprint
        );
        await releaseGuideBeneficiaryClaim(guidesCol, email, claimId);

        return res.status(400).json({
          ok: false,
          error: "AIRWALLEX_BENEFICIARY_VALIDATION_FAILED",
          retryAllowed: true
        });
      }

      await releaseUniqueGuideBankAccount(
        guidesCol,
        guide._id,
        bankFingerprint
      );
      await releaseGuideBeneficiaryClaim(guidesCol, email, claimId);
      throw validationError;
    }

    const created = await createAirwallexLiveBeneficiary({
      schemaInput,
      beneficiary,
      externalIdentifier
    });

    await recordCreatedAirwallexBeneficiary(
      guidesCol,
      email,
      claimId,
      created.id
    );

    await confirmUniqueGuideBankAccount(
      guidesCol,
      guide._id,
      bankFingerprint,
      created.id
    );
    const linked = await linkAirwallexBeneficiaryToGuide(
      guidesCol,
      email,
      created,
      schemaInput,
      claimId
    );

    return res.status(200).json({
      ok: true,
      airwallex: {
        beneficiaryId: linked.beneficiaryId,
        beneficiaryVerified: linked.beneficiaryVerified,
        beneficiaryVerifiedAt: linked.beneficiaryVerifiedAt,
        bankCountryCode: schemaInput.bankCountryCode,
        accountCurrency: schemaInput.accountCurrency,
        transferMethod: schemaInput.transferMethod
      }
    });
  } catch (error) {
    console.error("AIRWALLEX_GUIDE_ONBOARDING_ERROR", error.message);

    const status = error?.status === 409 ? 409 : 500;

    return res.status(status).json({
      ok: false,
      error: "AIRWALLEX_GUIDE_ONBOARDING_REVIEW_REQUIRED",
      retryAllowed: false
    });
  }
});
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
      error: "GUIDE_ME_ERROR"
    });
  }
});

router.patch("/me", requireAuth, async (req, res) => {
  try {
    const db = mongoose.connection?.db;

    if (!db) {
      return res.status(500).json({ ok: false, error: "Mongo not connected" });
    }

    const email = authEmail(req);

    if (!email) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const guidesCol = db.collection("guides");
    const existing = await guidesCol.findOne({ email });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "GUIDE_NOT_FOUND" });
    }


    const body = req.body && typeof req.body === "object" ? req.body : {};
    const now = new Date();
    const guideFields = {};

    const takeString = (key) => {
      if (!Object.prototype.hasOwnProperty.call(body, key) || body[key] === undefined) {
        return;
      }
      guideFields[key] = String(body[key]).trim();
    };

    takeString("name");
    takeString("phone");
    takeString("city");
    takeString("country");
    takeString("bio");
    takeString("languages");
    takeString("guideType");
    takeString("mainPhoto");
    takeString("avatarUrl");

    for (const key of ["priceHour", "priceDay", "price24h"]) {
      if (!Object.prototype.hasOwnProperty.call(body, key) || body[key] === undefined) {
        continue;
      }
      const n = Number(body[key]);
      guideFields[key] = Number.isFinite(n) ? n : 0;
    }

    if (Object.prototype.hasOwnProperty.call(body, "rates") && body.rates !== undefined) {
      guideFields.rates = body.rates;
    }

    if (Object.prototype.hasOwnProperty.call(body, "mediaDraft") && body.mediaDraft !== undefined) {
      guideFields.mediaDraft = body.mediaDraft;
    }

    if (Object.prototype.hasOwnProperty.call(body, "active") && body.active !== undefined) {
      guideFields.active = Boolean(body.active);
    }

    let passwordUpdated = false;

    if (Object.prototype.hasOwnProperty.call(body, "password") && body.password !== undefined) {
      const cleanPassword = String(body.password).trim();

      if (cleanPassword) {
        const usersCol = db.collection("users");
        const ur = await usersCol.updateOne(
          { email },
          { $set: { password: hashPassword(cleanPassword), updatedAt: now }, $inc: { tokenVersion: 1 } }
        );

        if (ur.matchedCount === 0) {
          return res.status(404).json({ ok: false, error: "USER_NOT_FOUND" });
        }

        passwordUpdated = true;
      }
    }

    const hasGuideFieldUpdates = Object.keys(guideFields).length > 0;

    if (hasGuideFieldUpdates || passwordUpdated) {
      console.log("GUIDE_PATCH", { fields: Object.keys(guideFields), passwordUpdated });

      await guidesCol.updateOne(
        { email },
        { $set: { ...guideFields, updatedAt: now } }
      );
    }

    const guide = await guidesCol.findOne({ email });

    return res.status(200).json({ ok: true, guide });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "GUIDE_PATCH_ME_ERROR"
    });
  }
});

function toPublicGuide(doc = {}) {
  const allowed = [
    "_id",
    "guideId",
    "name",
    "country",
    "countryCode",
    "code",
    "city",
    "languages",
    "priceHour",
    "priceDay",
    "price24h",
    "pricePerHour",
    "priceFullDay24h",
    "bio",
    "avatarUrl",
    "guideType",
    "mediaDraft",
    "rates",
    "rating",
    "reviewsCount",
    "active"
  ];

  const safe = {};
  for (const key of allowed) {
    if (doc[key] !== undefined) safe[key] = doc[key];
  }
  return safe;
}
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

    return res.json(docs.map(toPublicGuide));
  } catch (e) {
    return res.status(500).json({
      error: "GUIDES_FETCH_ERROR"
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
          ...toPublicGuide(doc),
          lat: point.lat,
          lng: point.lng,
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
      error: "GUIDES_NEARBY_ERROR"
    });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
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
      password,
      avatarUrl,
      mediaDraft,
            guideType,
      rates,
      lat,
      lng
    } = req.body || {};

    if (!name || !email || !city || !country) {
      return res.status(400).json({
        error: "MISSING_REQUIRED_FIELDS"
      });
    }

    const cleanEmail = String(email)
      .trim()
      .toLowerCase();

    const authenticatedEmail = String(req.user?.email || "").trim().toLowerCase();

    if (!authenticatedEmail || authenticatedEmail !== cleanEmail) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN_GUIDE_EMAIL" });
    }

    const db = mongoose.connection?.db;

    if (!db) {
      return res.status(500).json({
        error: "Mongo not connected"
      });
    }

    if (req.user?.role !== "guide") {
      return res.status(403).json({ ok: false, error: "GUIDE_ROLE_REQUIRED" });
    }

    const usersCol = db.collection("users");
    const existingUser = await usersCol.findOne({ email: cleanEmail });

    if (!existingUser || String(existingUser.role) !== "guide") {
      return res.status(403).json({ ok: false, error: "GUIDE_ROLE_REQUIRED" });
    }
    const guidesCol = db.collection("guides");
    const existingGuide = await guidesCol.findOne({ email: cleanEmail });
    if (existingGuide) {
      return res.status(409).json({ ok: false, error: "GUIDE_ALREADY_EXISTS" });
    }


    const now = new Date();

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
      avatarUrl: avatarUrl ? String(avatarUrl).trim() : "",
      mediaDraft: mediaDraft || null,
      guideType: guideType ? String(guideType).trim() : "certified",
      rates: rates || null,
lat: Number(lat),
      lng: Number(lng),
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
      error: "GUIDE_CREATE_ERROR"
    });
  }
});

export default router;
