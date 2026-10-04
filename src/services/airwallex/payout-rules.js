export function validateAirwallexPayout(booking) {
  if (!booking) throw new Error("BOOKING_REQUIRED");

  if (booking.status !== "COMPLETED") {
    throw new Error("BOOKING_NOT_COMPLETED");
  }

  if (booking.guidePayoutStatus !== "READY") {
    throw new Error("GUIDE_PAYOUT_NOT_READY");
  }

  if (!booking.stripePaymentIntentId) {
    throw new Error("STRIPE_PAYMENT_NOT_CONFIRMED");
  }

  const eligibleAt = new Date(booking.guidePayoutEligibleAt);

  if (
    !booking.guidePayoutEligibleAt ||
    Number.isNaN(eligibleAt.getTime()) ||
    eligibleAt.getTime() > Date.now()
  ) {
    throw new Error("PAYOUT_NOT_YET_ELIGIBLE");
  }

  const amountCents = Number(booking.guidePayoutAmountCents);

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("INVALID_GUIDE_PAYOUT_AMOUNT");
  }

  const paidAmountCents = Number(booking.amountCents);

  if (!Number.isSafeInteger(paidAmountCents) || paidAmountCents <= 0) {
    throw new Error("INVALID_ORIGINAL_PAYMENT_AMOUNT");
  }

  const expectedGuideAmountCents = Math.round(paidAmountCents * 0.9);

  if (amountCents !== expectedGuideAmountCents) {
    throw new Error("GUIDE_PAYOUT_AMOUNT_MISMATCH");
  }
  if (String(booking.currency || "").toLowerCase() !== "usd") {
    throw new Error("UNSUPPORTED_PAYOUT_CURRENCY");
  }

  return {
    bookingId: String(booking._id),
    amountCents,
    currency: "USD"
  };
}
