import { getAirwallexLiveTransfer } from "./client-live.js";
import { classifyAirwallexTransfer } from "./transfer-status.js";
import { validateAirwallexTransferIdentity } from "./reconciliation-guard.js";

export async function reconcileAirwallexLiveTransfers(Booking) {
  if (process.env.AIRWALLEX_ENV !== "live") {
    throw new Error("AIRWALLEX_LIVE_ONLY");
  }

  if (!Booking?.find || !Booking?.updateMany) {
    throw new Error("AIRWALLEX_BOOKING_MODEL_REQUIRED");
  }

  const bookings = await Booking.find({
    airwallexTransferId: { $exists: true, $nin: ["", null] },
    airwallexPayoutStatus: {
      $in: ["PROCESSING", "SENT", "RECONCILIATION_REQUIRED"]
    }
  })
    .select("_id airwallexTransferId airwallexRequestId airwallexBeneficiaryId airwallexPayoutStatus")
    .lean();

  const groups = new Map();

  for (const booking of bookings) {
    const id = String(booking.airwallexTransferId || "");
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(booking);
  }

  const results = [];

  for (const [transferId, groupBookings] of groups) {
    try {
      const transfer = await getAirwallexLiveTransfer(transferId);

      if (String(transfer?.id || "") !== transferId) {
        throw new Error("AIRWALLEX_TRANSFER_ID_MISMATCH");
      }

      for (const booking of groupBookings) {
        validateAirwallexTransferIdentity(booking, transfer);
      }
      const expectedRequestId = groupBookings[0].airwallexRequestId;
      const expectedBeneficiaryId = groupBookings[0].airwallexBeneficiaryId;

      if (
        !expectedRequestId ||
        !expectedBeneficiaryId ||
        groupBookings.some(
          (booking) =>
            booking.airwallexRequestId !== expectedRequestId ||
            booking.airwallexBeneficiaryId !== expectedBeneficiaryId
        )
      ) {
        throw new Error("AIRWALLEX_BATCH_IDENTITY_MISMATCH");
      }

      const ids = groupBookings.map((booking) => booking._id);
      const status = classifyAirwallexTransfer(transfer);

      if (
        status === "PROCESSING" &&
        groupBookings.some(
          (booking) => booking.airwallexPayoutStatus === "SENT"
        )
      ) {
        throw new Error("AIRWALLEX_TRANSFER_STATUS_REGRESSION");
      }

      const update = {
        airwallexPayoutStatus: status,
        airwallexPayoutError:
          status === "RECONCILIATION_REQUIRED"
            ? `AIRWALLEX_TRANSFER_STATUS_${transfer.status || "UNKNOWN"}`
            : ""
      };

      if (status === "COMPLETED") {
        update.airwallexCompletedAt = new Date();
    update.guidePayoutStatus = "TRANSFERRED";
    update.guidePayoutTransferredAt = update.airwallexCompletedAt;
      }

      const result = await Booking.updateMany(
        {
          _id: { $in: ids },
          airwallexTransferId: transferId,
          airwallexRequestId: groupBookings[0].airwallexRequestId,
          airwallexBeneficiaryId: groupBookings[0].airwallexBeneficiaryId,
          airwallexPayoutStatus: {
            $in: ["PROCESSING", "SENT", "RECONCILIATION_REQUIRED"]
          }
        },
        { $set: update }
      );

      results.push({
        transferId,
        status,
        modifiedCount: result.modifiedCount
      });

    } catch (error) {
      results.push({
        transferId,
        error: error.message
      });
    }
  }

  return results;
}
