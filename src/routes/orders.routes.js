import { Router } from "express";
import {
  createIntent,
  getOrderById,
  getOrderByPaymentIntentId,
  listOrders,
  stats,
  diagStripe,
} from "../controllers/orders.controller.js";

const router = Router();

router.get("/", listOrders);
router.get("/diag/stripe", diagStripe);
router.get("/by-pi/:paymentIntentId", getOrderByPaymentIntentId);
router.get("/:id([0-9a-fA-F]{24})", getOrderById);
router.get("/stats", stats);
router.post("/create-intent", createIntent);

export default router;
