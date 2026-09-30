import express from "express";
import helmet from "helmet";
import { connectAirwallexSandboxMongo } from "./services/airwallex-sandbox-mongo.js";
import airwallexWebhookRoutes from "./routes/airwallex.webhook.routes.js";

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

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4021);

await connectAirwallexSandboxMongo();

app.listen(PORT, HOST, () => {
  console.log(`Airwallex Sandbox receiver listening on ${PORT}`);
});
