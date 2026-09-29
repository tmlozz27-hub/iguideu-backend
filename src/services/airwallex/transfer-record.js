export async function recordAirwallexTransfer(Booking, booking, transfer, beneficiaryId) {
  if (!booking?._id || !booking.airwallexRequestId) {
    throw new Error("AIRWALLEX_CLAIM_REQUIRED");
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

  const updated = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      airwallexRequestId: booking.airwallexRequestId,
      airwallexPayoutStatus: "PROCESSING",
      airwallexTransferId: { $in: ["", null] }
    },
    {
      $set: {
        airwallexTransferId: transfer.id,
        airwallexBeneficiaryId: beneficiaryId
      }
    },
    { new: true }
  );

  if (!updated) {
    throw new Error("AIRWALLEX_TRANSFER_RECORD_CONFLICT");
  }

  return updated;
}
