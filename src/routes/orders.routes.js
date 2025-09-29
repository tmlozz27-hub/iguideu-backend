// src/routes/orders.routes.js
import express from "express";
import {
  createPaymentIntent,
  listOrders,
  getOrderById,
  getOrderByPaymentIntentId,
  getOrdersStats,
} from "../controllers/orders.controller.js";

const router = express.Router();

router.post("/create-intent", createPaymentIntent);

// ✅ declarar /stats ANTES que :id
router.get("/stats", getOrdersStats);

// Listado
router.get("/", listOrders);

// by-pi ANTES de :id
router.get("/by-pi/:paymentIntentId", getOrderByPaymentIntentId);

// :id restringido a ObjectId para no chocar con rutas estáticas
router.get("/:id([a-f\\d]{24})", getOrderById);

export default router;
