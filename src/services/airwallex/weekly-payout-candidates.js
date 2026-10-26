export async function findAirwallexWeeklyPayoutCandidates(Booking, now = new Date()) {
  if (!Booking?.find) {
    throw new Error("AIRWALLEX_BOOKING_MODEL_REQUIRED");
  }

  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("AIRWALLEX_VALID_DATE_REQUIRED");
  }

  const testBookingId = process.env.AIRWALLEX_TEST_BOOKING_ID;

  if (testBookingId !== "6ade5bdafbafd02eea2e8889") {
    throw new Error("AIRWALLEX_TEST_BOOKING_ID_REQUIRED");
  }

  return Booking.find({
    _id: testBookingId,
    status: "COMPLETED",
    guidePayoutStatus: "READY",
    stripeFundingStatus: "RECEIVED",
    guidePayoutEligibleAt: { $lte: now },
    stripePaymentIntentId: { $exists: true, $nin: ["", null] },
    stripeTransferId: { $in: ["", null] },
    airwallexTransferId: { $in: ["", null] },
    airwallexBatchId: { $in: ["", null] },
    $or: [
      { airwallexPayoutStatus: "NOT_STARTED" },
      { airwallexPayoutStatus: { $exists: false } }
    ]
  }).sort({ guideId: 1, guidePayoutEligibleAt: 1, _id: 1 });
}
