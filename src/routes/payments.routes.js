import { Router } from "express";
import { createPaymentIntent } from "../controllers/payments.controller.js";
const router = Router();

router.post("/intent", createPaymentIntent);

export default router;
