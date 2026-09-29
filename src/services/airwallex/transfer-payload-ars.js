import { validateAirwallexPayout } from "./payout-rules.js";
import { buildAirwallexPayoutAmount } from "./payout-amount.js";
import { validateGuideAirwallexBeneficiary } from "./guide-beneficiary.js";

export function buildAirwallexTransferPayloadArs(booking, guide) {
  const payout = validateAirwallexPayout(booking);
  const amount = buildAirwallexPayoutAmount(payout);
  const beneficiaryId = validateGuideAirwallexBeneficiary(booking, guide);

  return {
    beneficiary_id: beneficiaryId,
    source_currency: "USD",
    source_amount: amount.amount,
    transfer_currency: "ARS",
    fee_paid_by: "PAYER",
    reason: "travel",
    reference: `IGUIDEU-${payout.bookingId}`
  };
}
