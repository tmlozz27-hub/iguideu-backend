import { claimAirwallexPayout } from "./payout-claim.js";
import { createAirwallexTransfer } from "./client.js";
import { recordAirwallexTransfer } from "./transfer-record.js";

export async function executeAirwallexSandboxPayout(
  Booking,
  booking,
  payload
) {
  if (process.env.AIRWALLEX_ENV !== "sandbox") {
    throw new Error("AIRWALLEX_SANDBOX_ONLY");
  }

  const claimed = await claimAirwallexPayout(Booking, booking);

  let transfer;

  try {
    transfer = await createAirwallexTransfer(
      payload,
      claimed.airwallexRequestId
    );
  } catch (error) {
    // The request may have reached Airwallex.
    // Never automatically issue another transfer.
    throw new Error(
      "AIRWALLEX_CREATE_OUTCOME_UNCERTAIN_MANUAL_RECONCILIATION",
      { cause: error }
    );
  }

  try {
    return await recordAirwallexTransfer(
      Booking,
      claimed,
      transfer
    );
  } catch (error) {
    // Airwallex may already have created the transfer.
    // Preserve the claim for reconciliation; never retry creation.
    throw new Error(
      "AIRWALLEX_TRANSFER_RECORD_REQUIRES_RECONCILIATION",
      { cause: error }
    );
  }
}
