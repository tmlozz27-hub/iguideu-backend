import mongoose from "mongoose";
import { connectMongo } from "./services/mongo.js";
import Booking from "./models/Booking.js";
import Guide from "./models/Guide.js";
import { runAirwallexLiveWeeklyPayoutCycle } from "./services/airwallex/weekly-payout-cycle-live.js";

async function main() {
  if (process.env.AIRWALLEX_ENV !== "live") {
    throw new Error("AIRWALLEX_LIVE_ONLY");
  }

  if (process.env.AIRWALLEX_LIVE_PAYOUTS_ENABLED !== "true") {
    throw new Error("AIRWALLEX_LIVE_PAYOUTS_DISABLED");
  }

  await connectMongo();

  const results = await runAirwallexLiveWeeklyPayoutCycle(
    Booking,
    Guide,
    new Date()
  );

  const successful = results.filter((item) => item.status === "SUCCESS");
  const failed = results.filter((item) => item.status !== "SUCCESS");

  const summary = {
    status: failed.length > 0 ? "PARTIAL_FAILURE_REQUIRES_REVIEW" : "SUCCESS",
    guideCount: results.length,
    successfulGuides: successful.length,
    failedGuides: failed.length,
    successfulBookingCount: successful.reduce(
      (total, item) => total + item.bookingCount,
      0
    ),
    failedGuideIds: failed.map((item) => item.guideId)
  };

  console.log(
    "AIRWALLEX LIVE WEEKLY PAYOUT CYCLE RESULT",
    JSON.stringify(summary)
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

try {
  await main();
} finally {
  await mongoose.disconnect();
}
