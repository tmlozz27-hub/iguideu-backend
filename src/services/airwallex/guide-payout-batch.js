import { validateAirwallexPayout } from "./payout-rules.js";

export function buildGuidePayoutBatch(bookings, guideId) {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    throw new Error("AIRWALLEX_BATCH_BOOKINGS_REQUIRED");
  }

  const normalizedGuideId = String(guideId || "").trim();

  if (!normalizedGuideId) {
    throw new Error("AIRWALLEX_BATCH_GUIDE_ID_REQUIRED");
  }

  const items = bookings.map((booking) => {
    if (String(booking?.guideId || "") !== normalizedGuideId) {
      throw new Error("AIRWALLEX_BATCH_GUIDE_MISMATCH");
    }

    const payout = validateAirwallexPayout(booking);

    return {
      bookingId: payout.bookingId,
      amountCents: payout.amountCents,
      currency: payout.currency
    };
  });

  const amountCents = items.reduce(
    (total, item) => total + item.amountCents,
    0
  );

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("AIRWALLEX_BATCH_INVALID_TOTAL");
  }

  return {
    guideId: normalizedGuideId,
    currency: "USD",
    amountCents,
    bookingIds: items.map((item) => item.bookingId),
    items
  };
}
