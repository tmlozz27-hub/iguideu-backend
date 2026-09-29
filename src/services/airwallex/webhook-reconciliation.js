import { getAirwallexTransfer } from "./client.js";
import { persistAirwallexReconciliation } from "./reconciliation-store.js";

export async function reconcileAirwallexWebhookTransfer(
  Booking,
  booking,
  transferId
) {
  if (process.env.AIRWALLEX_ENV !== "sandbox") {
    throw new Error("AIRWALLEX_SANDBOX_ONLY");
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

  // Consult Airwallex directly. Never trust webhook status as proof.
  const transfer = await getAirwallexTransfer(String(transferId));

  // Identity verification and conditional database update
  // are performed by the existing reconciliation modules.
  return persistAirwallexReconciliation(Booking, booking, transfer);
}
