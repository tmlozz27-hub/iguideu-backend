import { inspectStripeFundingReceipt, reconcileAndRecordStripeFundingReceipt } from "./services/airwallex/stripe-funding-reconciliation.js";
import { executeStripeGuideFunding } from "./services/airwallex/stripe-funding-executor.js";
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
      ...(lastId ? { _id: { $eq: new mongoose.Types.ObjectId(testBookingId), $gt: lastId } } : {})
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

  if (process.env.STRIPE_FUNDING_DRY_RUN !== "true" && process.env.STRIPE_FUNDING_LIVE_ENABLED !== "true" && process.env.AIRWALLEX_LIVE_PAYOUTS_ENABLED !== "true" && process.env.STRIPE_FUNDING_RECONCILE_ONLY !== "true") {
    throw new Error("AIRWALLEX_LIVE_PAYOUTS_DISABLED");
  }

  if (
    process.env.STRIPE_FUNDING_LIVE_ENABLED === "true" &&
    process.env.AIRWALLEX_LIVE_PAYOUTS_ENABLED === "true"
  ) {
    throw new Error("STRIPE_AND_AIRWALLEX_CANNOT_RUN_TOGETHER");
  }

  if (
    process.env.STRIPE_FUNDING_DRY_RUN === "true" &&
    process.env.AIRWALLEX_LIVE_PAYOUTS_ENABLED === "true"
  ) {
    throw new Error("DRY_RUN_CANNOT_EXECUTE_LIVE_PAYOUTS");
  }

  await connectMongo();

  if (process.env.STRIPE_FUNDING_RECONCILE_ONLY === "true" || process.env.STRIPE_FUNDING_DRY_RUN === "true") {
    const depositId = process.env.AIRWALLEX_VERIFIED_DEPOSIT_ID || "";
    const independentlyMatched =
      process.env.AIRWALLEX_INDEPENDENT_MATCH_CONFIRMED === "true";

    const existingBooking = await Booking.findById(
      process.env.AIRWALLEX_TEST_BOOKING_ID
    ).lean();

    if (!existingBooking) {
      throw new Error("TEST_BOOKING_NOT_FOUND");
    }

    if (existingBooking.stripeFundingStatus === "RECEIVED") {
      if (process.env.AIRWALLEX_LIVE_PAYOUTS_ENABLED === "true") {
        const results = await runAirwallexLiveWeeklyPayoutCycle(
          Booking,
          Guide,
          new Date()
        );

        console.log(
          "AIRWALLEX AUTO PAYOUT RECOVERY",
          JSON.stringify({
            guideCount: results.length,
            bookingCount: results.reduce(
              (total, item) => total + item.bookingCount,
              0
            )
          })
        );
      } else {
        console.log("AIRWALLEX RECEIVED - PAYOUTS DISABLED");
      }

      return;
    }

    const result = await reconcileAndRecordStripeFundingReceipt(
          Booking,
          process.env.AIRWALLEX_TEST_BOOKING_ID,
          { depositId, independentlyMatched }
        );

    console.log("STRIPE AIRWALLEX RECEIPT", JSON.stringify(result));

    if (
      (result.recorded === true ||
        (await Booking.findById(process.env.AIRWALLEX_TEST_BOOKING_ID).lean())
          ?.stripeFundingStatus === "RECEIVED") &&
      process.env.AIRWALLEX_LIVE_PAYOUTS_ENABLED === "true"
    ) {
      const results = await runAirwallexLiveWeeklyPayoutCycle(
        Booking,
        Guide,
        new Date()
      );

      console.log(
        "AIRWALLEX AUTO PAYOUT AFTER RECEIPT",
        JSON.stringify({
          guideCount: results.length,
          bookingCount: results.reduce(
            (total, item) => total + item.bookingCount,
            0
          )
        })
      );
    }

    return;
  }

  const now = new Date();
  if (process.env.STRIPE_FUNDING_DRY_RUN === "true" && process.env.STRIPE_FUNDING_RECONCILE_ONLY !== "true") {
    const testBookingId = process.env.AIRWALLEX_TEST_BOOKING_ID;
    const booking = await Booking.findById(testBookingId).lean();

    if (!booking) {
      throw new Error("TEST_BOOKING_NOT_FOUND");
    }

    const amountCents = Number(booking.guidePayoutAmountCents);

    console.log("STRIPE FUNDING PREVIEW", {
      bookingId: String(booking._id),
      amountCents,
      commissionCents: Number(booking.amountCents) - amountCents,
      eligibleNow: eligible(booking, now),
      serviceDate: booking.date,
      serviceHours: booking.hours,
      paidAt: booking.paidAt,
      hasStripePaymentIntent: String(booking.stripePaymentIntentId || "").startsWith("pi_"),
      bookingStatus: booking.status,
      guidePayoutStatus: booking.guidePayoutStatus,
      airwallexPayoutStatus: booking.airwallexPayoutStatus,
      currency: booking.currency,
      currentTime: now.toISOString(),
      dryRun: true
    });

    return;
  }

  if (
    process.env.STRIPE_FUNDING_LIVE_ENABLED === "true" &&
    process.env.AIRWALLEX_LIVE_PAYOUTS_ENABLED !== "true"
  ) {
    const bookingId = process.env.AIRWALLEX_TEST_BOOKING_ID;
    const booking = await Booking.findById(bookingId).lean();

    if (!booking) {
      throw new Error("TEST_BOOKING_NOT_FOUND");
    }

    if (!eligible(booking, now) &&
        !(booking.status === "COMPLETED" &&
          booking.guidePayoutStatus === "READY" &&
          booking.guidePayoutEligibleAt &&
          new Date(booking.guidePayoutEligibleAt) <= now)) {
      throw new Error("STRIPE_FUNDING_BOOKING_NOT_ELIGIBLE");
    }

    if (booking.status === "PAID") {
      await prepareEligibleBookings(now);
    }

    const ready = await Booking.findById(bookingId).lean();

    if (
      !ready ||
      ready.status !== "COMPLETED" ||
      ready.guidePayoutStatus !== "READY" ||
      !ready.guidePayoutEligibleAt ||
      new Date(ready.guidePayoutEligibleAt) > now
    ) {
      throw new Error("STRIPE_FUNDING_NOT_READY_AFTER_PREPARATION");
    }

    await executeStripeGuideFunding(
      Booking,
      bookingId,
      Number(ready.guidePayoutAmountCents),
      { enabled: true }
    );

    console.log("STRIPE FUNDING ONLY COMPLETE");
    return;
  }

  const updated = await prepareEligibleBookings(now);

  console.log("AIRWALLEX ELIGIBILITY UPDATED", { updated });

  if (process.env.AIRWALLEX_LIVE_PAYOUTS_ENABLED !== "true" && process.env.STRIPE_FUNDING_RECONCILE_ONLY !== "true") {
    console.log("AIRWALLEX PAYOUTS DISABLED - FUNDING ONLY");
    return;
  }

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
