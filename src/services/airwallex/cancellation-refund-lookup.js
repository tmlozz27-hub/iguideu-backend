export async function findExistingCancellationRefund(stripe, booking) {
  const paymentIntentId = String(booking?.stripePaymentIntentId || "").trim();
  const bookingId = String(booking?._id || "").trim();

  if (!stripe?.refunds?.list || !paymentIntentId || !bookingId) {
    throw new Error("CANCELLATION_REFUND_LOOKUP_INVALID");
  }

  const matches = [];
  let startingAfter;

  do {
    const params = {
      payment_intent: paymentIntentId,
      limit: 100
    };

    if (startingAfter) params.starting_after = startingAfter;

    const page = await stripe.refunds.list(params);

    if (!Array.isArray(page?.data)) {
      throw new Error("CANCELLATION_REFUND_LOOKUP_RESPONSE_INVALID");
    }

    for (const refund of page.data) {
      if (
        refund?.payment_intent === paymentIntentId &&
        refund?.metadata?.bookingId === bookingId
      ) {
        matches.push(refund);
      }
    }

    if (!page.has_more) break;

    const lastId = page.data.at(-1)?.id;

    if (!lastId || lastId === startingAfter) {
      throw new Error("CANCELLATION_REFUND_LOOKUP_PAGINATION_INVALID");
    }

    startingAfter = lastId;
  } while (true);

  if (matches.length > 1) {
    throw new Error("CANCELLATION_MULTIPLE_REFUNDS_RECONCILIATION_REQUIRED");
  }

  return matches[0] || null;
}
