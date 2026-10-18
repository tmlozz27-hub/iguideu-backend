import { findExistingCancellationRefund } from "./cancellation-refund-lookup.js";
import { finalizeBookingCancellation } from "./cancellation-finalize.js";

export async function reconcileBookingCancellationRefund(
  Booking,
  stripe,
  booking,
  lock
) {
  if (!Booking || !stripe || !booking?._id || !lock) {
    throw new Error("CANCELLATION_RECONCILIATION_INPUT_INVALID");
  }

  if (
    booking.cancellationLock !== lock ||
    !["PENDING", "RECONCILIATION_REQUIRED", "SUCCEEDED"].includes(
      booking.cancellationRefundStatus
    )
  ) {
    throw new Error("CANCELLATION_RECONCILIATION_LOCK_INVALID");
  }

  if (booking.cancellationRefundStatus === "SUCCEEDED") {
    const savedRefundId = String(booking.cancellationStripeRefundId || "").trim();

    if (!savedRefundId) {
      throw new Error("CANCELLATION_SAVED_REFUND_MISSING");
    }

    const savedRefund = await stripe.refunds.retrieve(savedRefundId);

    if (
      savedRefund?.id !== savedRefundId ||
      savedRefund?.status !== "succeeded" ||
      String(savedRefund?.payment_intent || "") !== String(booking.stripePaymentIntentId || "") ||
      String(savedRefund?.metadata?.bookingId || "") !== String(booking._id)
    ) {
      throw new Error("CANCELLATION_SAVED_REFUND_MISMATCH");
    }

    return {
      refund: savedRefund,
      booking: await finalizeBookingCancellation(Booking, booking._id, lock)
    };
  }
  const refund = await findExistingCancellationRefund(stripe, booking);

  if (!refund) {
    throw new Error("CANCELLATION_REFUND_NOT_FOUND_REVIEW_REQUIRED");
  }

  if (refund.status !== "succeeded") {
    throw new Error("CANCELLATION_REFUND_NOT_SUCCEEDED_REVIEW_REQUIRED");
  }

  const recorded = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      cancellationLock: lock,
      cancellationRefundStatus: {
        $in: ["PENDING", "RECONCILIATION_REQUIRED"]
      },
      cancellationStripeRefundId: { $in: ["", null] },
      guidePayoutStatus: { $nin: ["PROCESSING", "TRANSFERRED"] },
      airwallexTransferId: { $in: ["", null] },
      airwallexBatchId: { $in: ["", null] },
      stripeTransferId: { $in: ["", null] },
      airwallexPayoutStatus: { $in: ["NOT_STARTED", null] }
    },
    {
      $set: {
        cancellationStripeRefundId: String(refund.id),
        cancellationRefundStatus: "SUCCEEDED"
      }
    },
    { new: true }
  );

  if (!recorded) {
    throw new Error("CANCELLATION_RECONCILIATION_RECORD_REJECTED");
  }

  return {
    refund,
    booking: await finalizeBookingCancellation(
      Booking,
      recorded._id,
      lock
    )
  };
}





