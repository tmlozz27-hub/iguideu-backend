import express from "express";
import Booking from "../models/Booking.js";
import Guide from "../models/Guide.js";

const router = express.Router();

/**
 * GET /
 * - Si mandás ?email=... devuelve bookings de ese travelerEmail
 * - Si NO mandás email, devuelve últimos 50 (debug)
 */
router.get("/", async (req, res) => {
  try {
    const email = String(req.query?.email || "").trim();

    if (!email) {
      const list = await Booking.find({}).sort({ createdAt: -1 }).limit(50).lean();
      return res.status(200).json({ ok: true, source: "db", email: null, bookings: list });
    }

    // Buscar por travelerEmail (principal) y por email (alias legacy)
    const bookings = await Booking.find({
      $or: [{ travelerEmail: email }, { email }],
    })
      .sort({ createdAt: -1 })
      .lean();

    // Enriquecer con datos del Guide si hay guideId/guide
    const guideIds = [
      ...new Set(
        bookings
          .map((b) => b.guideId || b.guide || b.guide_id)
          .filter(Boolean)
          .map((id) => id.toString())
      ),
    ];

    let guideMap = new Map();
    if (guideIds.length) {
      const guides = await Guide.find({ _id: { $in: guideIds } }).lean();
      guideMap = new Map(guides.map((g) => [g._id.toString(), g]));
    }

    const out = bookings.map((b) => {
      const gid =
        (b.guideId && b.guideId.toString()) ||
        (b.guide && b.guide.toString()) ||
        (b.guide_id && b.guide_id.toString());

      const g = gid ? guideMap.get(gid) : null;

      return {
        ...b,
        guideName: g?.name || b.guideName || b.guideTitle || "",
        guideLocation: g?.location || b.guideLocation || b.location || "",
        guideLanguages: g?.languages || b.guideLanguages || b.languages || [],
        guideRating: g?.rating ?? b.guideRating ?? b.rating ?? null,
      };
    });

    return res.status(200).json({ ok: true, source: "db", email, bookings: out });
  } catch (e) {
    console.error("BOOKINGS_LIST_FAILED:", e);
    return res.status(500).json({ error: "BOOKINGS_LIST_FAILED", message: e?.message || String(e) });
  }
});

/**
 * POST /
 * Crea booking PENDING.
 * Acepta aliases:
 * - travelerEmail o email
 * - amount o price
 */
router.post("/", async (req, res) => {
  try {
    const travelerEmail = String(req.body?.travelerEmail || req.body?.email || "").trim();
    if (!travelerEmail) {
      return res.status(400).json({ error: "travelerEmail required" });
    }

    const guideName = String(req.body?.guideName || req.body?.name || "Demo Guide");
    const guideId = String(req.body?.guideId || req.body?.guide || req.body?.guide_id || "");
    const startDate = req.body?.startDate ? String(req.body.startDate) : undefined;
    const durationHours = req.body?.durationHours ? Number(req.body.durationHours) : undefined;

    const amount = Number(req.body?.amount ?? req.body?.price ?? 0);
    const currency = String(req.body?.currency || "usd").toLowerCase();

    const doc = await Booking.create({
      travelerEmail,
      email: travelerEmail, // alias legacy para búsquedas viejas
      guideName,
      guideId: guideId || undefined,
      startDate,
      durationHours,
      amount,
      currency,
      status: "PENDING",
      paymentStatus: "PENDING",
    });

    return res.status(201).json({ ok: true, bookingId: doc._id, booking: doc });
  } catch (e) {
    console.error("BOOKING_CREATE_FAILED:", e);
    return res.status(500).json({ error: "BOOKING_CREATE_FAILED", message: e?.message || String(e) });
  }
});

export default router;


