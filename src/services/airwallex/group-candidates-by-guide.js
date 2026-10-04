export function groupAirwallexCandidatesByGuide(bookings) {
  if (!Array.isArray(bookings)) {
    throw new Error("AIRWALLEX_BOOKINGS_ARRAY_REQUIRED");
  }

  const groups = new Map();

  for (const booking of bookings) {
    const guideId = String(booking?.guideId || "").trim();

    if (!guideId) {
      throw new Error("AIRWALLEX_GUIDE_ID_REQUIRED");
    }

    if (!groups.has(guideId)) {
      groups.set(guideId, []);
    }

    groups.get(guideId).push(booking);
  }

  return Array.from(groups, ([guideId, guideBookings]) => ({
    guideId,
    bookings: guideBookings
  }));
}
