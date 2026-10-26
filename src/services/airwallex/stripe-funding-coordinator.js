import { claimStripeFunding } from "./stripe-funding-claim.js";

export async function prepareStripeGuideFunding(
  Booking,
  bookingId,
  amountCents,
  { dryRun = true } = {}
) {
  if (!dryRun) {
    throw new Error("STRIPE_FUNDING_EXECUTION_NOT_CONNECTED");
  }

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("INVALID_FUNDING_AMOUNT");
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    status: "COMPLETED",
    guidePayoutStatus: "READY",
    guidePayoutEligibleAt: { $lte: new Date() },
    guidePayoutAmountCents: amountCents,
    stripeFundingStatus: { $in: ["NOT_STARTED", null] }
  }).lean();

  if (!booking) {
    throw new Error("STRIPE_FUNDING_NOT_ELIGIBLE");
  }

  return {
    bookingId: String(bookingId),
    amountCents,
    commissionCents: booking.amountCents - amountCents,
    dryRun: true,
    status: "READY_FOR_FUNDING"
  };
}
