
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

// ✅ Ruta de stats
router.get("/stats", getOrdersStats);

// Listado
router.get("/", listOrders);

// by-pi ANTES de :id
router.get("/by-pi/:paymentIntentId", getOrderByPaymentIntentId);

// :id restringido a ObjectId para evitar conflictos
router.get("/:id([a-f\\d]{24})", getOrderById);

export default router;

