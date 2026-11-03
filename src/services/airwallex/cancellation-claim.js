import { randomUUID } from "node:crypto";
import { buildCancellationClaimFilter } from "./cancellation-claim-filter.js";

export async function claimBookingCancellation(Booking, booking) {
  if (!Booking || !booking?._id || !booking?.travelerEmail) {
    throw new Error("CANCELLATION_CLAIM_INPUT_INVALID");
  }

  const paymentIntentId = String(booking.stripePaymentIntentId || "").trim();

  if (booking.status === "PAID" && !paymentIntentId) {
    throw new Error("PAID_BOOKING_MISSING_PAYMENT_INTENT");
  }

  if (booking.status !== "PAID" && paymentIntentId) {
    throw new Error("PAYMENT_INTENT_RECONCILIATION_REQUIRED");
  }

  const lock = randomUUID();
  const now = new Date();

  const claimed = await Booking.findOneAndUpdate(
    {
      ...buildCancellationClaimFilter(booking._id, booking.travelerEmail),
      ...(booking.status === "PAID"
        ? {
            status: "PAID",
            stripePaymentIntentId: paymentIntentId
          }
        : {
            status: { $in: ["PENDING", "CONFIRMED"] },
            stripePaymentIntentId: { $in: ["", null] }
          })
    },
    {
      $set: {
        cancellationLock: lock,
        cancellationLockAt: now,
        cancellationRefundStatus: "PENDING"
      }
    },
    { new: true }
  );

  if (!claimed) {
    throw new Error("CANCELLATION_CLAIM_REJECTED");
  }

  return { booking: claimed, lock };
}
