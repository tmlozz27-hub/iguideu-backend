import express from "express";
import Booking from "../models/Booking.js";

const router = express.Router();

// Clave de administrador (podés usar la misma que usás en tus pruebas PowerShell)
const ADMIN_KEY = process.env.ADMIN_KEY || "ClaveUltraSecreta2025";

// Middleware simple de autenticación admin
router.use((req, res, next) => {
  const key = req.header("x-admin-key");
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized: invalid admin key",
    });
  }
  next();
});

// GET /api/admin/bookings
// Lista reservas, opcionalmente filtrando por email (?email=...).
router.get("/bookings", async (req, res) => {
  try {
    const { email } = req.query;
    const filter = {};

    if (email) {
      filter.email = email;
    }

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return res.json({
      ok: true,
      count: bookings.length,
      bookings,
    });
  } catch (err) {
    console.error("Error en /api/admin/bookings:", err);
    return res.status(500).json({
      ok: false,
      error: "Error obteniendo reservas",
    });
  }
});

// POST /api/admin/reset-demo-bookings
// Borra reservas DEMO (por ahora, las del email de pruebas).
router.post("/reset-demo-bookings", async (req, res) => {
  try {
    const result = await Booking.deleteMany({
      email: "test+frontend@iguideu.com",
    });

    return res.json({
      ok: true,
      deletedCount: result.deletedCount || 0,
    });
  } catch (err) {
    console.error("Error en /api/admin/reset-demo-bookings:", err);
    return res.status(500).json({
      ok: false,
      error: "Error reseteando reservas demo",
    });
  }
});

export default router;
