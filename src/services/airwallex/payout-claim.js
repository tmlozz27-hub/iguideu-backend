import { randomUUID } from "node:crypto";
import { validateAirwallexPayout } from "./payout-rules.js";
import { validateNoDuplicateAirwallexPayout } from "./duplicate-guard.js";

export async function claimAirwallexPayout(Booking, booking) {
  const payout = validateAirwallexPayout(booking);
  validateNoDuplicateAirwallexPayout(booking);

  const requestId = randomUUID();
  const now = new Date();

  const claimed = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      status: "COMPLETED",
      guidePayoutStatus: "READY",
      guidePayoutAmountCents: payout.amountCents,
      guidePayoutEligibleAt: { $lte: now },
      stripePaymentIntentId: { $exists: true, $nin: ["", null] },
      stripeTransferId: { $in: ["", null] },
      airwallexTransferId: { $in: ["", null] },
      $or: [{ airwallexPayoutStatus: "NOT_STARTED" }, { airwallexPayoutStatus: { $exists: false } }]
    },
    {
      $set: {
        airwallexPayoutStatus: "PROCESSING",
        airwallexRequestId: requestId,
        airwallexProcessingAt: now,
        airwallexPayoutError: ""
      }
    },
    { new: true }
  );

  if (!claimed) {
    throw new Error("AIRWALLEX_PAYOUT_CLAIM_REJECTED");
  }

  return claimed;
}
