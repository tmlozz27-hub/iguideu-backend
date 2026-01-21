import { Router } from "express";

const router = Router();

// helper: responde SIEMPRE 200 (para que el frontend no muera)
function ok(res, payload) {
  return res.status(200).json(payload);
}

router.get("/", async (req, res) => {
  const emailRaw = (req.query.email || "").toString().trim();
  const email = (() => {
    try { return decodeURIComponent(emailRaw || "").trim(); }
    catch { return (emailRaw || "").trim(); }
  })();

  try {
    // Intento cargar modelo
    let BookingModel = null;
    try {
      const mod = await import("../models/Booking.js");
      BookingModel = mod?.default || mod?.Booking || null;
    } catch (_) {
      BookingModel = null;
    }

    if (!BookingModel) {
      return ok(res, { ok: true, source: "fallback-no-model", email: email || null, bookings: [] });
    }

    // Si mongoose no está conectado, NO consultes (evita buffering timeout)
    let mongoose = null;
    try {
      const m = await import("mongoose");
      mongoose = m?.default || m;
    } catch (_) {
      mongoose = null;
    }

    const state = mongoose?.connection?.readyState; // 0=disconnected, 1=connected
    if (state !== 1) {
      return ok(res, {
        ok: true,
        source: "fallback-db-not-connected",
        email: email || null,
        bookings: [],
        dbState: state ?? null,
      });
    }

    const q = {};
    if (email) q.email = email;

    const bookings = await BookingModel.find(q).sort({ createdAt: -1 }).limit(200);
    return ok(res, { ok: true, source: "db", email: email || null, bookings });
  } catch (err) {
    console.error("[bookings] caught:", err?.message || err);
    return ok(res, { ok: false, source: "caught-error", error: err?.message || "bookings error", email: email || null, bookings: [] });
  }
});

export default router;
