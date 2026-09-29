import { prepareAirwallexReconciliation } from "./reconciliation.js";

export async function persistAirwallexReconciliation(Booking, booking, transfer) {
  const result = prepareAirwallexReconciliation(booking, transfer);

  const now = new Date();

  const update = {
    $set: {
      airwallexPayoutStatus: result.nextStatus
    }
  };

  if (result.nextStatus === "COMPLETED") {
    update.$set.airwallexCompletedAt = now;
  }

  const updated = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      airwallexTransferId: result.transferId,
      airwallexRequestId: result.requestId,
      airwallexPayoutStatus: result.currentStatus
    },
    update,
    { new: true }
  );

  if (!updated) {
    throw new Error("AIRWALLEX_RECONCILIATION_CONFLICT");
  }

  return updated;
}
