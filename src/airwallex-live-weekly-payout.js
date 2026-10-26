import mongoose from "mongoose";
import { connectMongo } from "./services/mongo.js";
import Booking from "./models/Booking.js";
import Guide from "./models/Guide.js";
import { runAirwallexLiveWeeklyPayoutCycle } from "./services/airwallex/weekly-payout-cycle-live.js";

function eligible(booking, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(booking.date || ""))) return false;

  const start = new Date(`${booking.date}T00:00:00.000Z`);
  const hours = Number(booking.hours);

  if (Number.isNaN(start.getTime()) ||
      !Number.isFinite(hours) || hours <= 0) return false;

  if (!(booking.paidAt instanceof Date) ||
      Number.isNaN(booking.paidAt.getTime())) return false;

  if (!String(booking.stripePaymentIntentId || "").startsWith("pi_")) return false;

  const amount = Number(booking.amountCents);
  if (!Number.isSafeInteger(amount) || amount <= 0) return false;

  if (Number(booking.guidePayoutAmountCents) !== Math.round(amount * 0.9)) return false;

  if (String(booking.currency).toLowerCase() !== "usd") return false;

  if (booking.stripeTransferId ||
      booking.airwallexTransferId ||
      booking.airwallexBatchId) return false;

  if (!["NOT_READY", "READY"].includes(booking.guidePayoutStatus)) return false;

  if (booking.airwallexPayoutStatus &&
      booking.airwallexPayoutStatus !== "NOT_STARTED") return false;

  return now.getTime() >= start.getTime() +
    hours * 3600000 + 48 * 3600000;
}

async function prepareEligibleBookings(now) {
  const testBookingId = process.env.AIRWALLEX_TEST_BOOKING_ID;

  if (testBookingId !== "6ade5bdafbafd02eea2e8889") {
    throw new Error("AIRWALLEX_TEST_BOOKING_ID_REQUIRED");
  }

  let lastId = null;
  let updated = 0;

  while (true) {
    const query = {
      _id: new mongoose.Types.ObjectId(testBookingId),
      status: "PAID",
      ...(lastId ? { _id: { $gt: lastId } } : {})
    };

    const bookings = await Booking.find(query)
      .sort({ _id: 1 })
      .limit(200)
      .lean();

    if (!bookings.length) break;

    lastId = bookings[bookings.length - 1]._id;

    const ids = bookings.filter(b => eligible(b, now)).map(b => b._id);

    if (ids.length) {
      const result = await Booking.updateMany(
        {
          _id: { $in: ids },
          status: "PAID",
          guidePayoutStatus: { $in: ["NOT_READY", "READY"] },
          stripeTransferId: { $in: ["", null] },
          airwallexTransferId: { $in: ["", null] },
          airwallexBatchId: { $in: ["", null] },
          $or: [
            { airwallexPayoutStatus: "NOT_STARTED" },
            { airwallexPayoutStatus: { $exists: false } }
          ]
        },
        {
          $set: {
            status: "COMPLETED",
            completedAt: now,
            guidePayoutStatus: "READY",
            guidePayoutEligibleAt: now
          }
        }
      );

      updated += result.modifiedCount || 0;
    }
  }

  return updated;
}

async function main() {
  if (process.env.AIRWALLEX_ENV !== "live") {
    throw new Error("AIRWALLEX_LIVE_ONLY");
  }

  if (process.env.AIRWALLEX_LIVE_PAYOUTS_ENABLED !== "true") {
    throw new Error("AIRWALLEX_LIVE_PAYOUTS_DISABLED");
  }

  await connectMongo();

  const now = new Date();
  const updated = await prepareEligibleBookings(now);

  console.log("AIRWALLEX ELIGIBILITY UPDATED", { updated });

  const results = await runAirwallexLiveWeeklyPayoutCycle(
    Booking, Guide, now
  );

  console.log(
    "AIRWALLEX LIVE WEEKLY PAYOUT CYCLE COMPLETED",
    JSON.stringify({
      guideCount: results.length,
      bookingCount: results.reduce(
        (total, item) => total + item.bookingCount, 0
      )
    })
  );
}

try {
  await main();
} finally {
  await mongoose.disconnect();
}
