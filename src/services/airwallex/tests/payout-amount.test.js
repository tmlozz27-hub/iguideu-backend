import assert from "node:assert/strict";
import { validateAirwallexPayout } from "../payout-rules.js";
import { buildAirwallexPayoutAmount } from "../payout-amount.js";

const booking = {
  _id: "BOOKING_TEST_90",
  status: "COMPLETED",
  guidePayoutStatus: "READY",
  stripePaymentIntentId: "pi_FAKE_TEST",
  guidePayoutEligibleAt: new Date(Date.now() - 60000),
  amountCents: 1000,
  guidePayoutAmountCents: 900,
  currency: "usd"
};

const payout = validateAirwallexPayout(booking);
const amount = buildAirwallexPayoutAmount(payout);

assert.equal(payout.amountCents, 900);
assert.deepEqual(amount, { currency: "USD", amount: "9.00" });

assert.throws(
  () => validateAirwallexPayout({
    ...booking,
    guidePayoutAmountCents: 899
  }),
  /GUIDE_PAYOUT_AMOUNT_MISMATCH/
);

console.log("AIRWALLEX_90_PERCENT_PERMANENT_TEST_OK");
