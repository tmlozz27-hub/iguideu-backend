export async function finalizeBookingCancellation(Booking, bookingId, lock) {
  if (!Booking || !bookingId || !lock) {
    throw new Error("CANCELLATION_FINALIZE_INPUT_INVALID");
  }

  const updated = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      cancellationLock: lock,
      cancellationRefundStatus: "SUCCEEDED",
      cancellationStripeRefundId: { $nin: ["", null] },
      status: { $in: ["PENDING", "CONFIRMED", "PAID"] },
      airwallexPayoutStatus: { $in: ["NOT_STARTED", null] },
      guidePayoutStatus: { $nin: ["PROCESSING", "TRANSFERRED"] },
      airwallexBatchId: { $in: ["", null] },
      airwallexTransferId: { $in: ["", null] },
      stripeTransferId: { $in: ["", null] }
    },
    {
      $set: {
        status: "CANCELLED",
        cancelledAt: new Date()
      }
    },
    { new: true }
  );

  if (!updated) {
    throw new Error("CANCELLATION_FINALIZE_REJECTED");
  }

  return updated;
}
