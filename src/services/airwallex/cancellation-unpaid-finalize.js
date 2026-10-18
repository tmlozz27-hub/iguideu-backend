export async function finalizeUnpaidBookingCancellation(Booking, bookingId, lock) {
  if (!Booking || !bookingId || !lock) {
    throw new Error("UNPAID_CANCELLATION_INPUT_INVALID");
  }

  const updated = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      cancellationLock: lock,
      status: { $in: ["PENDING", "CONFIRMED"] },
      stripePaymentIntentId: { $in: ["", null] },
      paymentIntentCreationLock: { $in: ["", null] },
      cancellationRefundStatus: "PENDING",
      airwallexPayoutStatus: { $in: ["NOT_STARTED", null] },
      guidePayoutStatus: { $nin: ["PROCESSING", "TRANSFERRED"] },
      airwallexBatchId: { $in: ["", null] },
      airwallexTransferId: { $in: ["", null] },
      stripeTransferId: { $in: ["", null] }
    },
    {
      $set: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationRefundStatus: "NOT_STARTED"
      },
      $unset: {
        cancellationLock: "",
        cancellationLockAt: ""
      }
    },
    { new: true }
  );

  if (!updated) {
    throw new Error("UNPAID_CANCELLATION_FINALIZE_REJECTED");
  }

  return updated;
}
