export function verifyAirwallexDepositForFunding({
  deposit,
  stripePayout,
  booking,
  independentlyMatched = false
}) {
  if (!independentlyMatched) {
    throw new Error("INDEPENDENT_BANK_MATCH_REQUIRED");
  }

  if (!deposit?.id || deposit.status !== "SETTLED") {
    throw new Error("AIRWALLEX_DEPOSIT_NOT_SETTLED");
  }

  if (stripePayout?.status !== "paid") {
    throw new Error("STRIPE_PAYOUT_NOT_PAID");
  }

  if (stripePayout.currency !== "usd") {
    throw new Error("STRIPE_PAYOUT_CURRENCY_MISMATCH");
  }

  const amountCents = Number(booking?.guidePayoutAmountCents);

  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    stripePayout.amount !== amountCents ||
    String(deposit.currency).toUpperCase() !== "USD" ||
    Math.round(Number(deposit.amount) * 100) !== amountCents
  ) {
    throw new Error("BANK_DEPOSIT_AMOUNT_MISMATCH");
  }

  return {
    bookingId: String(booking._id),
    stripePayoutId: stripePayout.id,
    airwallexDepositId: String(deposit.id),
    amountCents,
    airwallexReceiptConfirmed: true,
    readyToMarkReceived: true
  };
}
