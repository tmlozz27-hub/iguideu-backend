// ✅ GET /api/bookings?email=...
// Devuelve SOLO reservas de ese email (demo). Para producción real: reemplazar por auth real.
router.get("/", async (req, res) => {
  try {
    const emailRaw = String(req.query.email || "").trim();
    if (!emailRaw) return res.status(400).json({ ok: false, error: "email requerido" });

    // Normaliza: a veces el + viene como espacio si no está encodeado
    const email = emailRaw.replace(" ", "+").toLowerCase();

    // Intenta campos típicos (compatibilidad)
    const q = {
      $or: [
        { travelerEmail: email },
        { email: email },
        { traveler: email }
      ]
    };

    const bookings = await Booking.find(q).sort({ createdAt: -1 }).limit(200);

    return res.json({ ok: true, bookings });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "error listando reservas", details: String(e.message || e) });
  }
});
