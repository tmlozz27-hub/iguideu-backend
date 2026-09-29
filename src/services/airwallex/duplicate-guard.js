export function validateNoDuplicateAirwallexPayout(booking) {
  if (!booking) throw new Error("BOOKING_REQUIRED");

  if (booking.airwallexTransferId) {
    throw new Error("AIRWALLEX_TRANSFER_ALREADY_EXISTS");
  }

  if (
    ["PROCESSING", "SENT", "COMPLETED", "RECONCILIATION_REQUIRED"]
      .includes(booking.airwallexPayoutStatus)
  ) {
    throw new Error("AIRWALLEX_PAYOUT_ALREADY_STARTED");
  }

  if (booking.stripeTransferId) {
    throw new Error("EXISTING_STRIPE_CONNECT_TRANSFER_REQUIRES_REVIEW");
  }

  return true;
}
