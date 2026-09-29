import { classifyAirwallexTransfer } from "./transfer-status.js";
import { validateAirwallexTransferIdentity } from "./reconciliation-guard.js";

export function prepareAirwallexReconciliation(booking, transfer) {
  validateAirwallexTransferIdentity(booking, transfer);

  const currentStatus = String(booking.airwallexPayoutStatus || "");

  if (!["PROCESSING", "SENT", "RECONCILIATION_REQUIRED"].includes(currentStatus)) {
    throw new Error("AIRWALLEX_RECONCILIATION_INVALID_BOOKING_STATUS");
  }

  const nextStatus = classifyAirwallexTransfer(transfer);

  // Never downgrade a previously SENT transfer to PROCESSING.
  if (currentStatus === "SENT" && nextStatus === "PROCESSING") {
    throw new Error("AIRWALLEX_TRANSFER_STATUS_REGRESSION");
  }

  return {
    bookingId: String(booking._id),
    transferId: String(transfer.id),
    requestId: String(booking.airwallexRequestId),
    currentStatus,
    nextStatus
  };
}
