import { randomUUID } from "node:crypto";
import { buildGuidePayoutBatch } from "./guide-payout-batch.js";
import { validateNoDuplicateAirwallexPayout } from "./duplicate-guard.js";

export async function claimAirwallexGuideBatch(
  Booking,
  bookings,
  guideId,
  beneficiaryId
) {
  const batch = buildGuidePayoutBatch(bookings, guideId);

  if (
    typeof beneficiaryId !== "string" ||
    !/^[A-Za-z0-9_-]{3,128}$/.test(beneficiaryId)
  ) {
    throw new Error("AIRWALLEX_BENEFICIARY_ID_REQUIRED");
  }

  bookings.forEach(validateNoDuplicateAirwallexPayout);

  const batchId = randomUUID();
  const requestId = randomUUID();
  const now = new Date();
  const session = await Booking.startSession();

  try {
    await session.withTransaction(async () => {
      const result = await Booking.updateMany(
        {
          _id: { $in: batch.bookingIds },
          guideId: String(guideId),
          status: "COMPLETED",
          guidePayoutStatus: "READY",
          stripeFundingStatus: "RECEIVED",
          guidePayoutEligibleAt: { $lte: now },
          stripePaymentIntentId: { $exists: true, $nin: ["", null] },
          stripeTransferId: { $in: ["", null] },
          airwallexTransferId: { $in: ["", null] },
          airwallexBatchId: { $in: ["", null] },
          $or: [
            { airwallexPayoutStatus: "NOT_STARTED" },
            { airwallexPayoutStatus: { $exists: false } }
          ]
        },
        {
          $set: {
            airwallexBatchId: batchId,
            airwallexRequestId: requestId,
            airwallexBeneficiaryId: beneficiaryId,
            airwallexPayoutStatus: "PROCESSING",
            airwallexProcessingAt: now,
            airwallexPayoutError: ""
          }
        },
        { session }
      );

      if (result.modifiedCount !== batch.bookingIds.length) {
        throw new Error("AIRWALLEX_BATCH_CLAIM_REJECTED");
      }
    });
  } finally {
    await session.endSession();
  }

  return {
    ...batch,
    batchId,
    requestId,
    beneficiaryId
  };
}
