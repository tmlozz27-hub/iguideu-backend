import express from "express";
import helmet from "helmet";
import { connectAirwallexSandboxMongo } from "./services/airwallex-sandbox-mongo.js";
import airwallexWebhookRoutes from "./routes/airwallex.webhook.routes.js";
import Booking from "./models/Booking.js";

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

app.post("/sandbox/create-failed-test-booking", express.json(), async (_req, res) => {
  if (process.env.AIRWALLEX_ENV !== "sandbox") {
    return res.status(403).json({ error: "SANDBOX_ONLY" });
  }

  const booking = await Booking.findOneAndUpdate(
    { airwallexTransferId: "0e402e9a-6691-4539-94ea-a2539e4ab7f5" },
    {
      $setOnInsert: {
        travelerEmail: "sandbox-failed-test@invalid.example",
        airwallexRequestId: "1b7d89b0-efe4-489b-a121-37e3277844f8",
        airwallexBeneficiaryId: "2b769512-cdb2-4f83-9e2f-93ad0110da86",
        airwallexPayoutStatus: "PROCESSING",
        airwallexProcessingAt: new Date()
      }
    },
    { new: true, upsert: true }
  );

  res.status(200).json({
    ok: true,
    bookingId: booking._id,
    transferId: booking.airwallexTransferId,
    payoutStatus: booking.airwallexPayoutStatus
  });
});
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4021);

await connectAirwallexSandboxMongo();

app.listen(PORT, HOST, () => {
  console.log(`Airwallex Sandbox receiver listening on ${PORT}`);
});

