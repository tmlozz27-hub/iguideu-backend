import mongoose from "mongoose";
import { connectMongo } from "../services/mongo.js";
import { processGuidePayout } from "../services/guide-payouts.js";

async function main() {
  const stripeKey = String(process.env.STRIPE_SECRET_KEY || "").trim();

  if (!stripeKey) {
    throw new Error("STRIPE_SECRET_KEY_REQUIRED");
  }

  if (!stripeKey.startsWith("sk_live_")) {
    throw new Error("LIVE_MODE_REQUIRED_REFUSING_NON_LIVE_STRIPE_KEY");
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

  if (mongoDatabase !== "iguideu20") {
    throw new Error("PRODUCTION_MONGO_DATABASE_REQUIRED");
  }

  const connection = await connectMongo();

  if (!connection || mongoose.connection.readyState !== 1) {
    throw new Error("MONGO_CONNECTION_REQUIRED");
  }

  const db = mongoose.connection.db;
  const bookingsCol = db.collection("bookings");
  const now = new Date();

  const readyBookings = await bookingsCol
    .find({
      guidePayoutStatus: "READY",
      guidePayoutEligibleAt: { $lte: now },
      stripeTransferId: { $in: [null, ""] }
    })
    .sort({ guidePayoutEligibleAt: 1 })
    .limit(200)
    .toArray();

  console.log("GUIDE_PAYOUT_READY_COUNT", readyBookings.length);

  for (const booking of readyBookings) {
    try {
      const result = await processGuidePayout(String(booking._id));
      console.log(
        "GUIDE_PAYOUT_RESULT",
        JSON.stringify(result)
      );
    } catch (error) {
      console.error(
        "GUIDE_PAYOUT_BOOKING_FAILED",
        String(booking._id),
        String(error?.message || "UNKNOWN_ERROR")
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(
      "GUIDE_PAYOUT_LIVE_RUNNER_FAILED",
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
