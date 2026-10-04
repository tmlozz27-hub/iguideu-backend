export function validateAirwallexTransferIdentity(booking, transfer) {
  if (!booking || !transfer) {
    throw new Error("AIRWALLEX_RECONCILIATION_DATA_REQUIRED");
  }

  const expectedId = String(booking.airwallexTransferId || "").trim();
  const receivedId = String(transfer.id || "").trim();

  if (!expectedId || !receivedId || expectedId !== receivedId) {
    throw new Error("AIRWALLEX_TRANSFER_ID_MISMATCH");
  }

  const expectedRequestId = String(booking.airwallexRequestId || "").trim();

  if (!expectedRequestId) {
    throw new Error("AIRWALLEX_REQUEST_ID_MISSING");
  }

  if (
    transfer.request_id != null &&
    transfer.request_id !== expectedRequestId
  ) {
    throw new Error("AIRWALLEX_REQUEST_ID_MISMATCH");
  }

  const expectedBeneficiaryId = String(
    booking.airwallexBeneficiaryId || ""
  ).trim();

  if (
    !expectedBeneficiaryId ||
    transfer.beneficiary_id !== expectedBeneficiaryId
  ) {
    throw new Error("AIRWALLEX_BENEFICIARY_MISMATCH");
  }

  return true;
}
