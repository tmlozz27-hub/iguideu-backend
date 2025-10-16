import { Router } from "express";
import { createPaymentIntent, diagStripe } from "../controllers/payments.controller.js";

const router = Router();

router.get("/diag", diagStripe);
router.post("/create-intent", createPaymentIntent);

export default router;

