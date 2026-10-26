export async function recordStripeFundingPayout(
  Booking,
  bookingId,
  payout
) {
  if (!/^po_[A-Za-z0-9]+$/.test(String(payout?.id || ""))) {
    throw new Error("STRIPE_PAYOUT_ID_REQUIRED");
  }

  if (!Number.isSafeInteger(payout.amount) || payout.amount <= 0) {
    throw new Error("STRIPE_PAYOUT_AMOUNT_INVALID");
  }

  const result = await Booking.updateOne(
    {
      _id: bookingId,
      stripeFundingStatus: "PROCESSING",
      stripeFundingAmountCents: payout.amount,
      stripeFundingIdempotencyKey:
        `iguideu-guide-funding-${bookingId}-v1`,
      stripeFundingPayoutId: { $in: ["", null] }
    },
    {
      $set: {
        stripeFundingPayoutId: payout.id,
        stripeFundingStatus: "SENT",
        stripeFundingError: ""
      }
    }
  );

  if (result.modifiedCount !== 1) {
    throw new Error(
      "STRIPE_FUNDING_RECORD_REQUIRES_RECONCILIATION"
    );
  }

  return {
    bookingId: String(bookingId),
    payoutId: payout.id,
    amountCents: payout.amount,
    status: "SENT"
  };
}
