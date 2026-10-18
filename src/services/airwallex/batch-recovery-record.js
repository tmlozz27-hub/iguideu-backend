import { validateRecoveredAirwallexBatchTransfer } from "./batch-recovery-validation.js";
import { recordAirwallexBatchTransfer } from "./batch-transfer-record.js";

export async function recordRecoveredAirwallexBatchTransfer(
  Booking,
  manifest,
  transfer,
  AirwallexPayoutBatch,
  session
) {
  validateRecoveredAirwallexBatchTransfer(manifest, transfer);

  if (!session) {
    throw new Error("AIRWALLEX_RECOVERY_TRANSACTION_REQUIRED");
  }

  const claimedBatch = {
    batchId: manifest.batchId,
    requestId: manifest.requestId,
    bookingIds: manifest.bookingIds,
    amountCents: manifest.amountCents
  };

  return recordAirwallexBatchTransfer(
    Booking,
    claimedBatch,
    transfer,
    manifest.beneficiaryId,
    AirwallexPayoutBatch,
    session
  );
}
