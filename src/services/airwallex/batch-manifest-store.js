export async function createAirwallexBatchManifest(
  BatchModel,
  claimedBatch,
  session = null
) {
  if (
    !claimedBatch?.batchId ||
    !claimedBatch?.requestId ||
    !claimedBatch?.guideId ||
    !claimedBatch?.beneficiaryId ||
    !Array.isArray(claimedBatch.bookingIds) ||
    claimedBatch.bookingIds.length === 0
  ) {
    throw new Error("AIRWALLEX_MANIFEST_INVALID_BATCH");
  }

  const bookingIds = claimedBatch.bookingIds.map(String);

  if (
    new Set(bookingIds).size !== bookingIds.length ||
    bookingIds.some(id => !id)
  ) {
    throw new Error("AIRWALLEX_MANIFEST_DUPLICATE_BOOKING");
  }

  const amountCents = Number(claimedBatch.amountCents);

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("AIRWALLEX_MANIFEST_INVALID_AMOUNT");
  }

  if (claimedBatch.currency !== "USD") {
    throw new Error("AIRWALLEX_MANIFEST_INVALID_CURRENCY");
  }

  const created = await BatchModel.create([{
    batchId: claimedBatch.batchId,
    requestId: claimedBatch.requestId,
    guideId: claimedBatch.guideId,
    beneficiaryId: claimedBatch.beneficiaryId,
    bookingIds,
    amountCents,
    currency: "USD",
    status: "PREPARED",
    transferId: ""
  }], { session });

  return created[0];
}
