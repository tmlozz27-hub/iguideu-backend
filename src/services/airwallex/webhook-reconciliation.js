import { getAirwallexLiveTransfer } from "./client-live.js";
import { persistAirwallexReconciliation } from "./reconciliation-store.js";

export async function reconcileAirwallexWebhookTransfer(
  Booking,
  booking,
  transferId
) {
  if (process.env.AIRWALLEX_ENV !== "live") {
    throw new Error("AIRWALLEX_LIVE_ONLY");
  }

  if (!Booking || !booking?._id) {
    throw new Error("AIRWALLEX_BOOKING_REQUIRED");
  }

  if (
    !transferId ||
    String(booking.airwallexTransferId) !== String(transferId)
  ) {
    throw new Error("AIRWALLEX_TRANSFER_ID_MISMATCH");
  }

  // Never trust webhook status as proof. Re-query Airwallex LIVE.
  const transfer = await getAirwallexLiveTransfer(String(transferId));

  return persistAirwallexReconciliation(Booking, booking, transfer);
}
