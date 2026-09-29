export function validateAirwallexTransferIdentity(booking, transfer) {
  if (!booking || !transfer) {
    throw new Error("AIRWALLEX_RECONCILIATION_DATA_REQUIRED");
  }

  const expectedId = String(booking.airwallexTransferId || "").trim();
  const receivedId = String(transfer.id || "").trim();

  if (!expectedId || !receivedId || expectedId !== receivedId) {
    throw new Error("AIRWALLEX_TRANSFER_ID_MISMATCH");
  }

  if (!booking.airwallexRequestId) {
    throw new Error("AIRWALLEX_REQUEST_ID_MISSING");
  }

  return true;
}
