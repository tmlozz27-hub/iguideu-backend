export async function recordBookingCancellationRefund(
  Booking,
  bookingId,
  lock,
  refund
) {
  if (!Booking || !bookingId || !lock || !refund?.id) {
    throw new Error("CANCELLATION_REFUND_RECORD_INVALID");
  }

  const updated = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      cancellationLock: lock,
      cancellationRefundStatus: "PENDING"
    },
    {
      $set: {
        cancellationStripeRefundId: String(refund.id),
        cancellationRefundStatus:
          refund.status === "succeeded"
            ? "SUCCEEDED"
            : "RECONCILIATION_REQUIRED"
      }
    },
    { new: true }
  );

  if (!updated) {
    throw new Error("CANCELLATION_REFUND_RECORD_REJECTED");
  }

  return updated;
}
