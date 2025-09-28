import { Router } from "express";
import express from "express";
import { stripeWebhook } from "../controllers/webhooks.controller.js";

const router = Router();

// /api/webhooks/stripe usa RAW body para verificación de firma
router.post("/stripe", express.raw({ type: "application/json" }), stripeWebhook);

export default router;
