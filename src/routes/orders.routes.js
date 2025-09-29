// src/routes/orders.routes.js
import { Router } from "express";
import {
  createPaymentIntentAndOrder,
  listOrders,
  getOrderById,
  getOrderByPaymentIntentId, // ✅ existe en el controller
  getOrdersStats,            // opcional
} from "../controllers/orders.controller.js";

const router = Router();

// Listado
router.get("/", listOrders);

// (Opcional) stats dentro del router
router.get("/stats", getOrdersStats);

// ⚠️ Importante: declarar by-pi ANTES de /:id
router.get("/by-pi/:paymentIntentId", getOrderByPaymentIntentId);

// :id restringido a ObjectId para no pisar otras rutas
router.get("/:id([0-9a-fA-F]{24})", getOrderById);

// Crear intent + order
router.post("/create-intent", createPaymentIntentAndOrder);

export default router;
