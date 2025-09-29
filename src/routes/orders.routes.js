// src/routes/orders.routes.js
import express from "express";
import {
  createPaymentIntent,
  listOrders,
  getOrderById,
  getOrderByPaymentIntentId,
} from "../controllers/orders.controller.js";

const router = express.Router();

// Crear PaymentIntent + Order
router.post("/create-intent", createPaymentIntent);

// Listado con paginación simple ?limit=&page=
router.get("/", listOrders);

// Buscar por paymentIntentId (declárala ANTES que :id)
router.get("/by-pi/:paymentIntentId", getOrderByPaymentIntentId);

// Buscar por _id de Mongo (restringimos a 24 hex para no chocar con /by-pi)
router.get("/:id([a-f\\d]{24})", getOrderById);

export default router;
