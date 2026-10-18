export function assertBookingRefundPayoutSafe(booking) {
  if (!booking) {
    throw new Error("BOOKING_REQUIRED");
  }

  const payout = String(booking.airwallexPayoutStatus || "NOT_STARTED").toUpperCase();
  const guidePayout = String(booking.guidePayoutStatus || "NOT_READY").toUpperCase();

  if (
    payout !== "NOT_STARTED" ||
    ["PROCESSING", "TRANSFERRED"].includes(guidePayout) ||
    booking.airwallexBatchId ||
    booking.airwallexTransferId ||
    booking.stripeTransferId
  ) {
    throw new Error("BOOKING_REFUND_PAYOUT_CONFLICT");
  }

  return true;
}
