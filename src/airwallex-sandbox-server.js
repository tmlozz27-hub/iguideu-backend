import express from "express";
import helmet from "helmet";
import { connectAirwallexSandboxMongo } from "./services/airwallex-sandbox-mongo.js";
import airwallexWebhookRoutes from "./routes/airwallex.webhook.routes.js";
import Booking from "./models/Booking.js";
import Guide from "./models/Guide.js";
import { executeAirwallexSandboxPayout } from "./services/airwallex/payout-executor.js";

if (process.env.AIRWALLEX_ENV !== "sandbox") {
  throw new Error("AIRWALLEX_SANDBOX_ONLY");
}

if (!process.env.AIRWALLEX_SANDBOX_MONGO_URI) {
  throw new Error("AIRWALLEX_SANDBOX_MONGO_URI_MISSING");
}

const app = express();

app.use(helmet());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "OK",
    service: "airwallex-sandbox"
  });
});

app.use(
  "/api/airwallex/webhook",
  express.raw({
    type: "application/json",
    limit: "256kb"
  }),
  airwallexWebhookRoutes
);

app.post("/api/airwallex/test/prepare-integral", express.json(), async (_req, res) => {
  try {
    if (process.env.AIRWALLEX_ENV !== "sandbox") {
      throw new Error("AIRWALLEX_SANDBOX_ONLY");
    }

    const beneficiaryId = String(
      process.env.AIRWALLEX_SANDBOX_BENEFICIARY_ID || ""
    ).trim();

    if (!beneficiaryId) {
      throw new Error("AIRWALLEX_SANDBOX_BENEFICIARY_ID_MISSING");
    }

    const guide = await Guide.create({
      userEmail: "airwallex-integral-guide@invalid.example",
      name: "Airwallex Integral Sandbox Guide",
      airwallex: {
        beneficiaryId,
        beneficiaryVerified: true,
        beneficiaryVerifiedAt: new Date()
      }
    });

    const booking = await Booking.create({
      travelerName: "Airwallex Integral Sandbox Traveler",
      travelerEmail: "airwallex-integral-traveler@invalid.example",
      guideId: String(guide._id),
      guideName: guide.name,
      currency: "usd",
      amountCents: 1000,
      totalCents: 1000,
      totalAmountCents: 1000,
      status: "COMPLETED",
      stripePaymentIntentId: "pi_SANDBOX_INTEGRAL_FAKE",
      guidePayoutAmountCents: 900,
      guidePayoutStatus: "READY",
      guidePayoutEligibleAt: new Date(),
      paidAt: new Date(),
      completedAt: new Date(),
      airwallexPayoutStatus: "NOT_STARTED"
    });

    res.status(201).json({
      ok: true,
      bookingId: String(booking._id),
      guideId: String(guide._id),
      amountCents: booking.amountCents,
      guidePayoutAmountCents: booking.guidePayoutAmountCents,
      airwallexPayoutStatus: booking.airwallexPayoutStatus
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: String(error?.message || "UNKNOWN_ERROR")
    });
  }
});
app.post("/api/airwallex/test/run-integral/:bookingId", express.json(), async (req, res) => {
  try {
    if (process.env.AIRWALLEX_ENV !== "sandbox") {
      throw new Error("AIRWALLEX_SANDBOX_ONLY");
    }

    const booking = await Booking.findById(req.params.bookingId);

    if (!booking) {
      return res.status(404).json({
        ok: false,
        error: "BOOKING_NOT_FOUND"
      });
    }

    const guide = await Guide.findById(booking.guideId);

    if (!guide) {
      return res.status(404).json({
        ok: false,
        error: "GUIDE_NOT_FOUND"
      });
    }

    const result = await executeAirwallexSandboxPayout(
      Booking,
      booking,
      guide
    );

    res.status(200).json({
      ok: true,
      bookingId: String(booking._id),
      result
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: String(error?.message || "UNKNOWN_ERROR")
    });
  }
});
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4021);

await connectAirwallexSandboxMongo();

app.listen(PORT, HOST, () => {
  console.log(`Airwallex Sandbox receiver listening on ${PORT}`);
});
