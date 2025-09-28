import { Router } from "express";
import {
  createPaymentIntent,
  getOrderById,
  listOrders,
  getOrderByPaymentIntent,
} from "../controllers/orders.controller.js";

const router = Router();

// POST /api/orders/create-intent → crea PaymentIntent y registra Order
router.post("/create-intent", createPaymentIntent);

// GET /api/orders → listar (paginado ?page=&limit=)
router.get("/", listOrders);

// GET /api/orders/by-pi/:paymentIntentId → buscar por PaymentIntent
router.get("/by-pi/:paymentIntentId", getOrderByPaymentIntent);

// GET /api/orders/:id → ver una order por ID (sólo si es un ObjectId válido)
router.get("/:id([0-9a-fA-F]{24})", getOrderById);

export default router;
