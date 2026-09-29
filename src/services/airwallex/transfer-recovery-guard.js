export function validateAirwallexRecoveredTransfer(booking, transfers) {
  if (!booking?._id || !booking.airwallexRequestId) {
    throw new Error("AIRWALLEX_RECOVERY_CLAIM_REQUIRED");
  }

  if (
    booking.airwallexPayoutStatus !== "PROCESSING" ||
    booking.airwallexTransferId
  ) {
    throw new Error("AIRWALLEX_RECOVERY_INVALID_BOOKING_STATE");
  }

  if (!Array.isArray(transfers)) {
    throw new Error("AIRWALLEX_RECOVERY_INVALID_RESPONSE");
  }

  const matches = transfers.filter(
    transfer =>
      transfer &&
      transfer.request_id === booking.airwallexRequestId
  );

  if (matches.length !== 1) {
    throw new Error("AIRWALLEX_RECOVERY_REQUIRES_MANUAL_RECONCILIATION");
  }

  const transfer = matches[0];

  if (typeof transfer.id !== "string" || !transfer.id.trim()) {
    throw new Error("AIRWALLEX_RECOVERY_TRANSFER_ID_MISSING");
  }

  if (
    !booking.airwallexBeneficiaryId ||
    transfer.beneficiary_id !== booking.airwallexBeneficiaryId
  ) {
    throw new Error("AIRWALLEX_RECOVERY_BENEFICIARY_MISMATCH");
  }

  return transfer;
}
