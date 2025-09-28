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

// ⚠️ IMPORTANTE: declarar /by-pi ANTES de /:id para evitar colisión de rutas
// GET /api/orders/by-pi/:paymentIntentId → buscar por PaymentIntent
router.get("/by-pi/:paymentIntentId", getOrderByPaymentIntent);

// GET /api/orders/:id → ver una order por ID
router.get("/:id", getOrderById);

export default router;
