import { Router } from "express";
import { createPaymentIntent, getOrderById, listOrders } from "../controllers/orders.controller.js";

const router = Router();

// POST /api/orders/create-intent  → crea PaymentIntent y registra Order
router.post("/create-intent", createPaymentIntent);

// GET /api/orders                → listar (paginado ?page=&limit=)
router.get("/", listOrders);

// GET /api/orders/:id            → ver una order
router.get("/:id", getOrderById);

export default router;
