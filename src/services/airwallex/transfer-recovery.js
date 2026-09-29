import { findAirwallexTransferByRequestId } from "./transfer-lookup.js";
import { validateAirwallexRecoveredTransfer } from "./transfer-recovery-guard.js";
import { recordAirwallexTransfer } from "./transfer-record.js";

export async function recoverAirwallexSandboxTransfer(Booking, booking) {
  if (process.env.AIRWALLEX_ENV !== "sandbox") {
    throw new Error("AIRWALLEX_SANDBOX_ONLY");
  }

  if (
    !booking?._id ||
    !booking.airwallexRequestId ||
    !booking.airwallexBeneficiaryId ||
    booking.airwallexPayoutStatus !== "PROCESSING" ||
    booking.airwallexTransferId
  ) {
    throw new Error("AIRWALLEX_RECOVERY_INVALID_BOOKING_STATE");
  }

  const transfers = await findAirwallexTransferByRequestId(
    booking.airwallexRequestId
  );

  const transfer = validateAirwallexRecoveredTransfer(
    booking,
    transfers
  );

  return recordAirwallexTransfer(
    Booking,
    booking,
    transfer,
    booking.airwallexBeneficiaryId
  );
}
