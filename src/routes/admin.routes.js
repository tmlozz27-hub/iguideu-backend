import { Router } from "express";
import authRequired from "../middlewares/authRequired.js";
import requireRole from "../middlewares/requireRole.js";
import Booking from "../models/Booking.js";

const router = Router();

// GET /api/admin/bookings -> últimas 50 (solo admin)
router.get("/bookings", authRequired, requireRole("admin"), async (req,res)=>{
  try{
    const bookings = await Booking.find({}).sort({ createdAt: -1 }).limit(50);
    res.json({ bookings });
  }catch(e){
    console.error("GET /admin/bookings", e);
    res.status(500).json({ error: "internal error" });
  }
});

export default router;
