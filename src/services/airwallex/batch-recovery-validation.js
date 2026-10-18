export function validateRecoveredAirwallexBatchTransfer(batch, transfer) {
  if (
    !batch?.batchId ||
    !batch?.requestId ||
    !batch?.beneficiaryId ||
    !Number.isSafeInteger(batch.amountCents) ||
    batch.amountCents <= 0 ||
    batch.currency !== "USD" ||
    !Array.isArray(batch.bookingIds) ||
    batch.bookingIds.length === 0
  ) {
    throw new Error("AIRWALLEX_RECOVERY_INVALID_MANIFEST");
  }

  if (
    batch.status !== "PREPARED" ||
    (batch.transferId && String(batch.transferId).trim())
  ) {
    throw new Error("AIRWALLEX_RECOVERY_BATCH_ALREADY_LINKED");
  }

  if (
    !transfer ||
    typeof transfer.id !== "string" ||
    !transfer.id.trim() ||
    transfer.request_id !== batch.requestId ||
    transfer.beneficiary_id !== batch.beneficiaryId ||
    transfer.source_currency !== "USD"
  ) {
    throw new Error("AIRWALLEX_RECOVERY_TRANSFER_IDENTITY_MISMATCH");
  }

  const expectedAmount = (batch.amountCents / 100).toFixed(2);
  const receivedAmount = String(transfer.source_amount ?? "");

  if (
    !/^\d+(\.\d{1,2})?$/.test(receivedAmount) ||
    Number(receivedAmount).toFixed(2) !== expectedAmount
  ) {
    throw new Error("AIRWALLEX_RECOVERY_AMOUNT_MISMATCH");
  }

  return true;
}
