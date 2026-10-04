export async function recordAirwallexBatchTransfer(
  Booking,
  claimedBatch,
  transfer,
  beneficiaryId
) {
  if (
    !claimedBatch?.batchId ||
    !claimedBatch?.requestId ||
    !Array.isArray(claimedBatch.bookingIds) ||
    claimedBatch.bookingIds.length === 0
  ) {
    throw new Error("AIRWALLEX_BATCH_CLAIM_REQUIRED");
  }

  if (!transfer?.id || typeof transfer.id !== "string") {
    throw new Error("AIRWALLEX_TRANSFER_ID_REQUIRED");
  }

  if (
    typeof beneficiaryId !== "string" ||
    !/^[A-Za-z0-9_-]{3,128}$/.test(beneficiaryId)
  ) {
    throw new Error("AIRWALLEX_BENEFICIARY_ID_REQUIRED");
  }

  const result = await Booking.updateMany(
    {
      _id: { $in: claimedBatch.bookingIds },
      airwallexBatchId: claimedBatch.batchId,
      airwallexRequestId: claimedBatch.requestId,
      airwallexPayoutStatus: "PROCESSING",
      airwallexTransferId: { $in: ["", null] }
    },
    {
      $set: {
        airwallexTransferId: transfer.id,
        airwallexBeneficiaryId: beneficiaryId
      }
    }
  );

  if (result.modifiedCount !== claimedBatch.bookingIds.length) {
    throw new Error("AIRWALLEX_BATCH_TRANSFER_RECORD_REQUIRES_RECONCILIATION");
  }

  return {
    batchId: claimedBatch.batchId,
    requestId: claimedBatch.requestId,
    transferId: transfer.id,
    bookingIds: claimedBatch.bookingIds,
    modifiedCount: result.modifiedCount
  };
}
