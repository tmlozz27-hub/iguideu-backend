// src/routes/orders.routes.js
import { Router } from "express";
import {
  createPaymentIntent,
  listOrders,
  getOrderById,
  getOrderByPaymentIntentId,
  orderStats,
  diagStripe,
} from "../controllers/orders.controller.js";

const router = Router();

// Middleware admin simple para /stats (x-admin-key)
router.use("/stats", (req, res, next) => {
  const headerKey = req.get("x-admin-key");
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey || headerKey !== adminKey) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
});

// Listado (primero, para que no pise /:id)
router.get("/", listOrders);

// Buscar por PaymentIntentId (antes que :id)
router.get("/by-pi/:paymentIntentId", getOrderByPaymentIntentId);

// Stats (protegido)
router.get("/stats", orderStats);

// Diagnóstico Stripe
router.get("/diag/stripe", diagStripe);

// Crear PaymentIntent + Order
router.post("/create-intent", createPaymentIntent);

// :id SOLO si tiene forma de ObjectId
router.get("/:id([0-9a-fA-F]{24})", getOrderById);

export default router;
