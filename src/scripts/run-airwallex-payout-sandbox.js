import mongoose from "mongoose";
import { connectAirwallexSandboxMongo } from "../services/airwallex-sandbox-mongo.js";
import { executeAirwallexSandboxPayout } from "../services/airwallex/payout-executor.js";
import Booking from "../models/Booking.js";
import Guide from "../models/Guide.js";

async function main() {
  if (process.env.AIRWALLEX_ENV !== "sandbox") {
    throw new Error("AIRWALLEX_SANDBOX_ONLY");
  }

  const bookingId = String(process.argv[2] || "").trim();

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new Error("VALID_BOOKING_ID_REQUIRED");
  }

  await connectAirwallexSandboxMongo();

  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  const guideId = String(booking.guideId || "").trim();

  if (!mongoose.Types.ObjectId.isValid(guideId)) {
    throw new Error("INVALID_GUIDE_ID");
  }

  const guide = await Guide.findById(guideId);

  if (!guide) {
    throw new Error("GUIDE_NOT_FOUND");
  }

  const result = await executeAirwallexSandboxPayout(
    Booking,
    booking,
    guide
  );

  console.log(
    "AIRWALLEX_SANDBOX_PAYOUT_RESULT",
    JSON.stringify(result)
  );
}

main()
  .catch((error) => {
    console.error(
      "AIRWALLEX_SANDBOX_PAYOUT_FAILED",
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
