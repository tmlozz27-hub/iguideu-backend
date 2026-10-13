
export async function recordAirwallexBatchTransfer(
  Booking,
  claimedBatch,
  transfer,
  beneficiaryId,
  AirwallexPayoutBatch,
  session
) {
  if (
    !claimedBatch?.batchId ||
    !claimedBatch?.requestId ||
    !Array.isArray(claimedBatch.bookingIds) ||
    claimedBatch.bookingIds.length === 0 ||
    new Set(claimedBatch.bookingIds.map(String)).size !==
      claimedBatch.bookingIds.length
  ) {
    throw new Error("AIRWALLEX_BATCH_CLAIM_REQUIRED");
  }

  if (
    typeof beneficiaryId !== "string" ||
    !/^[A-Za-z0-9_-]{3,128}$/.test(beneficiaryId)
  ) {
    throw new Error("AIRWALLEX_BENEFICIARY_ID_REQUIRED");
  }

  if (
    typeof transfer?.id !== "string" ||
    !transfer.id.trim()
  ) {
    throw new Error("AIRWALLEX_TRANSFER_ID_REQUIRED");
  }

  // Verificar los datos devueltos por Airwallex.
  if (
    transfer.request_id != null &&
    transfer.request_id !== claimedBatch.requestId
  ) {
    throw new Error("AIRWALLEX_TRANSFER_REQUEST_MISMATCH");
  }

  if (
    transfer.beneficiary_id != null &&
    transfer.beneficiary_id !== beneficiaryId
  ) {
    throw new Error("AIRWALLEX_TRANSFER_BENEFICIARY_MISMATCH");
  }

  if (
    transfer.source_currency != null &&
    transfer.source_currency !== "USD"
  ) {
    throw new Error("AIRWALLEX_TRANSFER_CURRENCY_MISMATCH");
  }

  if (claimedBatch.amountCents != null) {
    if (
      !Number.isSafeInteger(claimedBatch.amountCents) ||
      claimedBatch.amountCents <= 0
    ) {
      throw new Error("AIRWALLEX_BATCH_AMOUNT_INVALID");
    }

    if (transfer.source_amount != null) {
      const expected = (
        claimedBatch.amountCents / 100
      ).toFixed(2);

      const amount = String(transfer.source_amount);

      if (
        !/^\d+(\.\d{1,2})?$/.test(amount) ||
        Number(amount).toFixed(2) !== expected
      ) {
        throw new Error("AIRWALLEX_TRANSFER_AMOUNT_MISMATCH");
      }
    }
  }

  if (!AirwallexPayoutBatch?.updateOne || !session) {
    throw new Error("AIRWALLEX_BATCH_TRANSACTION_REQUIRED");
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
    },
    { session }
  );

  if (result.modifiedCount !== claimedBatch.bookingIds.length) {
    throw new Error(
      "AIRWALLEX_BATCH_TRANSFER_RECORD_REQUIRES_RECONCILIATION"
    );
  }

  const manifestResult = await AirwallexPayoutBatch.updateOne(
    {
      batchId: claimedBatch.batchId,
      requestId: claimedBatch.requestId,
      transferId: "",
      status: "PREPARED"
    },
    {
      $set: {
        transferId: transfer.id,
        status: "PROCESSING"
      }
    },
    { session }
  );

  if (manifestResult.modifiedCount !== 1) {
    throw new Error("AIRWALLEX_BATCH_MANIFEST_RECORD_MISMATCH");
  }

  return {
    batchId: claimedBatch.batchId,
    requestId: claimedBatch.requestId,
    transferId: transfer.id,
    bookingIds: claimedBatch.bookingIds,
    modifiedCount: result.modifiedCount
  };
}
