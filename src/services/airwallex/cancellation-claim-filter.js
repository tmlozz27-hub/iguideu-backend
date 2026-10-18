export function buildCancellationClaimFilter(bookingId, travelerEmail) {
  return {
    _id: bookingId,
    travelerEmail,
    status: { $in: ["PENDING", "CONFIRMED", "PAID"] },
    cancellationLock: { $in: ["", null] },
    paymentIntentCreationLock: { $in: ["", null] },
    cancellationRefundStatus: { $in: ["NOT_STARTED", null] },
    airwallexPayoutStatus: { $in: ["NOT_STARTED", null] },
    guidePayoutStatus: { $nin: ["PROCESSING", "TRANSFERRED"] },
    airwallexBatchId: { $in: ["", null] },
    airwallexTransferId: { $in: ["", null] },
    stripeTransferId: { $in: ["", null] }
  };
}
