// src/routes/webhooks.routes.js
import express from "express";
import { stripeWebhookHandler } from "../controllers/webhooks.controller.js";

const router = express.Router();

// Stripe requiere el body RAW para validar la firma
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  (req, _res, next) => { req.rawBody = req.body; next(); },
  stripeWebhookHandler
);

// Ping opcional para verificar montaje
router.get("/_ping", (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));

export default router;
