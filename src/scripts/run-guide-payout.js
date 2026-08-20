import mongoose from "mongoose";
import { connectMongo } from "../services/mongo.js";
import { processGuidePayout } from "../services/guide-payouts.js";

async function main() {
  const bookingId = String(process.argv[2] || "").trim();

  if (!bookingId) {
    throw new Error("BOOKING_ID_REQUIRED");
  }

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new Error("INVALID_BOOKING_ID");
  }

  const stripeKey = String(process.env.STRIPE_SECRET_KEY || "").trim();

  if (!stripeKey) {
    throw new Error("STRIPE_SECRET_KEY_REQUIRED");
  }

  if (!stripeKey.startsWith("sk_test_")) {
    throw new Error("TEST_MODE_REQUIRED_REFUSING_NON_TEST_STRIPE_KEY");
  }

  const mongoUri = String(
    process.env.MONGO_URI || process.env.MONGODB_URI || ""
  ).trim();

  if (!mongoUri) {
    throw new Error("MONGO_URI_REQUIRED");
  }

  let mongoDatabase = "";

  try {
    mongoDatabase = new URL(mongoUri).pathname.replace(/^\//, "");
  } catch {
    throw new Error("INVALID_MONGO_URI");
  }

  if (mongoDatabase !== "iguideu20_connect_test") {
    throw new Error("MONGO_TEST_DATABASE_REQUIRED");
  }

  const connection = await connectMongo();

  if (!connection || mongoose.connection.readyState !== 1) {
    throw new Error("MONGO_CONNECTION_REQUIRED");
  }

  const result = await processGuidePayout(bookingId);

  console.log("GUIDE_PAYOUT_RESULT", JSON.stringify(result));
}

main()
  .catch((error) => {
    console.error(
      "GUIDE_PAYOUT_RUNNER_FAILED",
      String(error?.message || "UNKNOWN_ERROR")
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      process.exitCode = 1;
    }
  });
