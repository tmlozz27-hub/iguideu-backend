import { validateAirwallexPayout } from "./payout-rules.js";
import { buildAirwallexPayoutAmount } from "./payout-amount.js";
import { validateGuideAirwallexBeneficiary } from "./guide-beneficiary.js";

export function buildAirwallexTransferPayload(booking, guide) {
  const payout = validateAirwallexPayout(booking);
  const amount = buildAirwallexPayoutAmount(payout);
  const beneficiaryId = validateGuideAirwallexBeneficiary(booking, guide);

  return {
    beneficiary_id: beneficiaryId,
    transfer_currency: amount.currency,
    transfer_amount: amount.amount
  };
}
