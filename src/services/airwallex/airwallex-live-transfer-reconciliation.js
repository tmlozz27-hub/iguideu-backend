import { getAirwallexLiveTransfer } from "./client-live.js";
import { classifyAirwallexTransfer } from "./transfer-status.js";

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
    .select("_id airwallexTransferId airwallexPayoutStatus")
    .lean();

  const groups = new Map();

  for (const booking of bookings) {
    const id = String(booking.airwallexTransferId || "");
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(booking._id);
  }

  const results = [];

  for (const [transferId, ids] of groups) {
    try {
      const transfer = await getAirwallexLiveTransfer(transferId);

      if (String(transfer?.id || "") !== transferId) {
        throw new Error("AIRWALLEX_TRANSFER_ID_MISMATCH");
      }

      const status = classifyAirwallexTransfer(transfer);

      const update = {
        airwallexPayoutStatus: status,
        airwallexPayoutError:
          status === "RECONCILIATION_REQUIRED"
            ? `AIRWALLEX_TRANSFER_STATUS_${transfer.status || "UNKNOWN"}`
            : ""
      };

      if (status === "COMPLETED") {
        update.airwallexCompletedAt = new Date();
      }

      const result = await Booking.updateMany(
        {
          _id: { $in: ids },
          airwallexTransferId: transferId,
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
