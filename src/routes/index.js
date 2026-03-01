import express from "express";

import guidesRoutes from "./guides.routes.js";
import paymentsRoutes from "./payments.routes.js";
import bookingsRoutes from "./bookings.routes.js";

const router = express.Router();

router.get("/health", (req, res) => {
  return res.status(200).json({ status: "OK" });
});

router.use("/guides", guidesRoutes);
router.use("/payments", paymentsRoutes);
router.use("/bookings", bookingsRoutes);

export default router;