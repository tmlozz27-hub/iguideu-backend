import { claimAirwallexPayout } from "./payout-claim.js";
import { createAirwallexTransfer } from "./client.js";
import { recordAirwallexTransfer } from "./transfer-record.js";
import { buildAirwallexTransferPayloadArs } from "./transfer-payload-ars.js";

export async function executeAirwallexSandboxPayout(
  Booking,
  booking,
  guide
) {
  if (process.env.AIRWALLEX_ENV !== "sandbox") {
    throw new Error("AIRWALLEX_SANDBOX_ONLY");
  }

  // Validate the booking, amount, guide and beneficiary before claiming.
  const payload = buildAirwallexTransferPayloadArs(booking, guide);

  // Persist the beneficiary together with the request ID before the API call.
  const claimed = await claimAirwallexPayout(
    Booking,
    booking,
    payload.beneficiary_id
  );

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
    throw new Error(
      "AIRWALLEX_TRANSFER_RECORD_REQUIRES_RECONCILIATION",
      { cause: error }
    );
  }
}
