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

// ✅ /stats DEBE ir ANTES de :id
router.get("/stats", getOrdersStats);

// Listado
router.get("/", listOrders);

// by-pi ANTES de :id
router.get("/by-pi/:paymentIntentId", getOrderByPaymentIntentId);

// :id restringido a ObjectId para no chocar con /stats o /by-pi
router.get("/:id([a-f\\d]{24})", getOrderById);

export default router;
