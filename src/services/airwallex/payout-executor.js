import { claimAirwallexPayout } from "./payout-claim.js";
import { createAirwallexTransfer } from "./client.js";
import { recordAirwallexTransfer } from "./transfer-record.js";
import { buildAirwallexTransferPayload } from "./transfer-payload.js";

export async function executeAirwallexSandboxPayout(
  Booking,
  booking,
  guide
) {
  if (process.env.AIRWALLEX_ENV !== "sandbox") {
    throw new Error("AIRWALLEX_SANDBOX_ONLY");
  }

  // Validate the booking, amount and guide ownership before claiming.
  buildAirwallexTransferPayload(booking, guide);

  const claimed = await claimAirwallexPayout(Booking, booking);

  // Build again using the atomically claimed booking.
  const payload = buildAirwallexTransferPayload(claimed, guide);

  let transfer;

  try {
    transfer = await createAirwallexTransfer(
      payload,
      claimed.airwallexRequestId
    );
  } catch (error) {
    // The request may have reached Airwallex. Never retry automatically.
    throw new Error(
      "AIRWALLEX_CREATE_OUTCOME_UNCERTAIN_MANUAL_RECONCILIATION",
      { cause: error }
    );
  }

  try {
    return await recordAirwallexTransfer(
      Booking,
      claimed,
      transfer,
      payload.beneficiary_id
    );
  } catch (error) {
    // Preserve the claim for manual reconciliation.
    throw new Error(
      "AIRWALLEX_TRANSFER_RECORD_REQUIRES_RECONCILIATION",
      { cause: error }
    );
  }
}
