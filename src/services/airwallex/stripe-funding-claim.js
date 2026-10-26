export async function claimStripeFunding(Booking, bookingId, amountCents) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("INVALID_FUNDING_AMOUNT");
  }

  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: "COMPLETED",
      guidePayoutStatus: "READY",
      guidePayoutEligibleAt: { $lte: new Date() },
      guidePayoutAmountCents: amountCents,
      stripePaymentIntentId: { $exists: true, $nin: ["", null] },
      stripeFundingStatus: { $in: ["NOT_STARTED", null] },
      stripeFundingPayoutId: { $in: ["", null] }
    },
    {
      $set: {
        stripeFundingStatus: "PROCESSING",
        stripeFundingIdempotencyKey: `iguideu-guide-funding-${bookingId}-v1`,
        stripeFundingAmountCents: amountCents,
        stripeFundingRequestedAt: new Date(),
        stripeFundingError: ""
      }
    },
    { new: true }
  );

  if (!booking) {
    throw new Error("STRIPE_FUNDING_ALREADY_CLAIMED_OR_NOT_ELIGIBLE");
  }

  return booking;
}
