import { Router } from "express";
import Booking from "../models/Booking.js";

const router = Router();

// health simple
router.get("/health", (req, res) =>
  res.json({ ok: true, service: "bookings", ts: Date.now() })
);

// GET /api/bookings?email=...
router.get("/", async (req, res) => {
  try {
    const email = (req.query.email || "").toString().trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Missing email" });

    const list = await Booking.find({ travelerEmail: email })
      .sort({ createdAt: -1 })
      .lean();

    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "bookings_list_failed", message: e?.message || String(e) });
  }
});

// POST /api/bookings
// Acepta formatos:
// A) { travelerEmail, travelerName?, guideId, guideName, city?, country?, type?, hoursRequested?, totalUsd? }
// B) { userEmail, userName?, guideId, guideName?, city?, country?, kind?, hours?, totalUsd? }  (ALIAS)
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};

    const travelerEmailRaw =
      body.travelerEmail ?? body.userEmail ?? body.email ?? "";
    const travelerEmail = travelerEmailRaw.toString().trim().toLowerCase();

    const travelerName = (body.travelerName || body.userName || "Traveler").toString();

    const guideId = (body.guideId || "").toString().trim();

    // si no viene guideName, NO tiramos 400
    const guideName = (body.guideName || body.name || "Unknown Guide").toString().trim();

    const city = (body.city || "").toString();
    const country = (body.country || "").toString();

    if (!travelerEmail) return res.status(400).json({ error: "Missing travelerEmail (or userEmail)" });
    if (!guideId) return res.status(400).json({ error: "Missing guideId" });

    const type = (body.type ?? body.kind ?? "hour").toString();
    const hoursRequested = Number(body.hoursRequested ?? body.hours ?? 2);
    const totalUsd = Number(body.totalUsd ?? 0);

    const created = await Booking.create({
      travelerEmail,
      travelerName,
      guideId,
      guideName,
      city,
      country,
      type,
      hoursRequested,
      totalUsd,
      status: "created",
    });

    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: "booking_create_failed", message: e?.message || String(e) });
  }
});

export default router;
