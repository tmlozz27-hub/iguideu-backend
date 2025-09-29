// src/routes/orders.routes.js
import { Router } from "express";
import {
  createPaymentIntentAndOrder,
  listOrders,
  getOrderById,
  getOrderByPaymentIntentId,
  getOrdersStats,
} from "../controllers/orders.controller.js";

const router = Router();

// Listado
router.get("/", listOrders);

// ⚠️ by-pi ANTES de /:id
router.get("/by-pi/:paymentIntentId", getOrderByPaymentIntentId);

// Stats dentro del router
router.get("/stats", getOrdersStats);

// :id restringido a ObjectId
router.get("/:id([0-9a-fA-F]{24})", getOrderById);

// Crear intent + order
router.post("/create-intent", createPaymentIntentAndOrder);

export default router;
