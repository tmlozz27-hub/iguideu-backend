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

  console.log(
    "AIRWALLEX LIVE WEEKLY PAYOUT CYCLE COMPLETED",
    JSON.stringify({
      guideCount: results.length,
      bookingCount: results.reduce(
        (total, item) => total + item.bookingCount,
        0
      )
    })
  );
}

try {
  await main();
} finally {
  await mongoose.disconnect();
}
