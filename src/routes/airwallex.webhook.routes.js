import express from "express";
import Booking from "../models/Booking.js";
import { verifyAirwallexWebhookSignature } from "../services/airwallex/webhook-signature.js";
import { reconcileAirwallexWebhookTransfer } from "../services/airwallex/webhook-reconciliation.js";

const router = express.Router();

const allowedEvents = new Set([
  "payout.transfer.processing",
  "payout.transfer.sent",
  "payout.transfer.paid",
  "payout.transfer.failed",
  "payout.transfer.cancelled"
]);

router.post("/", async (req, res) => {
  if (process.env.AIRWALLEX_ENV !== "sandbox") {
    return res.status(503).json({ error: "AIRWALLEX_SANDBOX_ONLY" });
  }

  const secret = process.env.AIRWALLEX_WEBHOOK_SECRET;

  if (!secret) {
    return res.status(503).json({ error: "WEBHOOK_NOT_CONFIGURED" });
  }

  const valid = verifyAirwallexWebhookSignature({
    rawBody: req.body,
    timestamp: req.headers["x-timestamp"],
    signature: req.headers["x-signature"],
    secret
  });

  if (!valid) {
    return res.status(400).json({ error: "INVALID_WEBHOOK_SIGNATURE" });
  }

  let event;

  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "INVALID_WEBHOOK_JSON" });
  }

  if (
    typeof event?.id !== "string" ||
    !event.id.trim() ||
    !allowedEvents.has(event.name)
  ) {
    return res.status(400).json({ error: "UNSUPPORTED_WEBHOOK_EVENT" });
  }

  const transferId = event.data?.id;

  if (typeof transferId !== "string" || !transferId.trim()) {
    return res.status(400).json({ error: "WEBHOOK_TRANSFER_ID_MISSING" });
  }

  try {
    const booking = await Booking.findOne({
      airwallexTransferId: transferId
    });

    if (!booking) {
      return res.status(503).json({ error: "BOOKING_NOT_FOUND_FOR_TRANSFER" });
    }

    await reconcileAirwallexWebhookTransfer(
      Booking,
      booking,
      transferId
    );

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("AIRWALLEX_SANDBOX_WEBHOOK_ERROR", error.message);
    return res.status(503).json({ error: "WEBHOOK_RECONCILIATION_FAILED" });
  }
});

export default router;
