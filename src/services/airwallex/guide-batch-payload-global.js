import { buildAirwallexPayoutAmount } from "./payout-amount.js";
import { normalizeAirwallexPayoutRoute } from "./payout-route.js";

export function buildAirwallexGuideBatchPayloadGlobal(
  batch,
  beneficiaryId,
  batchId,
  routeInput
) {
  if (!batch || !Array.isArray(batch.bookingIds) || batch.bookingIds.length === 0) {
    throw new Error("AIRWALLEX_BATCH_REQUIRED");
  }

  if (
    typeof beneficiaryId !== "string" ||
    !/^[A-Za-z0-9_-]{3,128}$/.test(beneficiaryId)
  ) {
    throw new Error("AIRWALLEX_BENEFICIARY_ID_REQUIRED");
  }

  if (
    typeof batchId !== "string" ||
    !/^[A-Za-z0-9_-]{3,128}$/.test(batchId)
  ) {
    throw new Error("AIRWALLEX_BATCH_ID_REQUIRED");
  }

  const route = normalizeAirwallexPayoutRoute(routeInput);

  const amount = buildAirwallexPayoutAmount({
    currency: batch.currency,
    amountCents: batch.amountCents
  });

  return {
    beneficiary_id: beneficiaryId,
    source_currency: "USD",
    source_amount: amount.amount,
    transfer_currency: route.accountCurrency,
    transfer_method: route.transferMethod,
    fee_paid_by: "PAYER",
    reason: "travel",
    reference: `IGUIDEU-BATCH-${batchId}`
  };
}
