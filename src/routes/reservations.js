// src/routes/reservations.js  (ESM)  ✅ export default
import express from "express";

export default function reservationsRoutes({ Reservation }) {
  const router = express.Router();

  const pickEmail = (req) => {
    const b = req.body || {};
    const q = req.query || {};
    const email =
      b.travelerEmail ||
      b.email ||
      b.userEmail ||
      b.customerEmail ||
      q.email ||
      "";
    return String(email || "").trim();
  };

  // GET /api/reservations?email=...
  router.get("/", async (req, res) => {
    try {
      const travelerEmail = pickEmail(req);
      if (!travelerEmail) return res.status(400).json({ ok: false, error: "EMAIL_REQUIRED" });

      const list = await Reservation.find({ travelerEmail }).sort({ createdAt: -1 }).lean();
      return res.json({ ok: true, reservations: list });
    } catch (err) {
      console.log("[RESERVATIONS_GET_ERROR]", err?.message || err);
      return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // POST /api/reservations
  router.post("/", async (req, res) => {
    try {
      const body = req.body || {};

      const gid = String(body.gid || body.guideId || "").trim();
      const date = String(body.date || body.bookingDate || body.reservationDate || "").trim();

      const durationType = String(body.durationType || body.type || body.duration || "hours").trim();
      const hoursRaw = body.hours ?? body.durationHours ?? body.qtyHours ?? body.horas;
      const hours = Number(hoursRaw);

      // ✅ unificar email -> travelerEmail
      const travelerEmail = pickEmail(req);
      if (!travelerEmail) return res.status(400).json({ ok: false, error: "EMAIL_REQUIRED" });

      if (!gid) return res.status(400).json({ ok: false, error: "GID_REQUIRED" });
      if (!date) return res.status(400).json({ ok: false, error: "DATE_REQUIRED" });

      if ((durationType === "hours" || durationType === "hour") && (!Number.isFinite(hours) || hours <= 0)) {
        return res.status(400).json({ ok: false, error: "HOURS_REQUIRED" });
      }

      const doc = await Reservation.create({
        gid,
        travelerEmail,
        email: travelerEmail, // compat
        date,
        durationType: durationType === "hour" ? "hours" : durationType,
        hours: Number.isFinite(hours) ? hours : undefined,
        status: body.status || "pending",
        meta: body.meta || {},
      });

      return res.json({ ok: true, reservation: doc });
    } catch (err) {
      console.log("[RESERVATIONS_POST_ERROR]", err?.message || err);
      return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
    }
  });

  return router;
}
