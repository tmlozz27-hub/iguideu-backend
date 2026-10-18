import { randomUUID } from "node:crypto";
import { buildGuidePayoutBatch } from "./guide-payout-batch.js";
import { validateNoDuplicateAirwallexPayout } from "./duplicate-guard.js";

export async function claimAirwallexGuideBatch(
  Booking,
  bookings,
  guideId,
  beneficiaryId,
  session = null
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

  const bookingIds = batch.bookingIds;

  const result = await Booking.updateMany(
    {
      _id: { $in: bookingIds },
      guideId: String(guideId),
      status: "COMPLETED",
        cancellationLock: { $in: ["", null] },
        cancellationRefundStatus: { $in: ["NOT_STARTED", null] },

      guidePayoutStatus: "READY",
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
    }
  , { session });

  if (result.modifiedCount !== bookingIds.length) {
    if (session) {
      throw new Error("AIRWALLEX_BATCH_CLAIM_REJECTED_TRANSACTION_ABORT");
    }
    await Booking.updateMany(
      {
        _id: { $in: bookingIds },
        airwallexBatchId: batchId,
        airwallexRequestId: requestId,
        airwallexTransferId: { $in: ["", null] }
      },
      {
        $set: {
          airwallexBatchId: "",
          airwallexRequestId: "",
          airwallexBeneficiaryId: "",
          airwallexPayoutStatus: "NOT_STARTED",
          airwallexProcessingAt: null,
          airwallexPayoutError: ""
        }
      }
    );

    throw new Error("AIRWALLEX_BATCH_CLAIM_REJECTED_ROLLED_BACK");
  }

  return {
    ...batch,
    batchId,
    requestId,
    beneficiaryId
  };
}
