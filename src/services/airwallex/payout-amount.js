export function buildAirwallexPayoutAmount(payout) {
  if (!payout || payout.currency !== "USD") {
    throw new Error("AIRWALLEX_INVALID_PAYOUT_CURRENCY");
  }

  const cents = payout.amountCents;

  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error("AIRWALLEX_INVALID_PAYOUT_CENTS");
  }

  return {
    currency: "USD",
    amount: (cents / 100).toFixed(2)
  };
}
