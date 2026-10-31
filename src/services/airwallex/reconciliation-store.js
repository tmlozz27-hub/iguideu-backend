import { prepareAirwallexReconciliation } from "./reconciliation.js";

export async function persistAirwallexReconciliation(Booking, booking, transfer) {
  const result = prepareAirwallexReconciliation(booking, transfer);

  const update = {
    $set: {
      airwallexPayoutStatus: result.nextStatus
    }
  };

  if (result.nextStatus === "COMPLETED") {
    update.$set.airwallexCompletedAt = new Date();
    update.$set.guidePayoutStatus = "TRANSFERRED";
    update.$set.guidePayoutTransferredAt = update.$set.airwallexCompletedAt;
  }

  const filter = {
    _id: booking._id,
    airwallexTransferId: result.transferId,
    airwallexRequestId: result.requestId,
    airwallexPayoutStatus: result.currentStatus
  };

  const updated = await Booking.findOneAndUpdate(
    filter,
    update,
    { new: true }
  );

  if (updated) return updated;

  // Another notification may have updated this booking first.
  // Read the latest state and verify its identity again.
  const latest = await Booking.findById(booking._id);

  if (!latest) {
    throw new Error("AIRWALLEX_RECONCILIATION_CONFLICT");
  }

  const { validateAirwallexTransferIdentity } = await import("./reconciliation-guard.js");
  const { classifyAirwallexTransfer } = await import("./transfer-status.js");

  validateAirwallexTransferIdentity(latest, transfer);

  if (
    latest.airwallexPayoutStatus === "COMPLETED" &&
    latest.guidePayoutStatus === "TRANSFERRED" &&
    latest.guidePayoutTransferredAt &&
    classifyAirwallexTransfer(transfer) === "COMPLETED"
  ) {
    return latest;
  }

  if (latest.airwallexPayoutStatus !== "COMPLETED") {
    const latestResult = prepareAirwallexReconciliation(latest, transfer);

    if (latestResult.currentStatus === latestResult.nextStatus) {
      return latest;
    }
  }

  throw new Error("AIRWALLEX_RECONCILIATION_CONFLICT");
}
