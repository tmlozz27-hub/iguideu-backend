import { findAirwallexWeeklyPayoutCandidates } from "./weekly-payout-candidates.js";
import { groupAirwallexCandidatesByGuide } from "./group-candidates-by-guide.js";
import { buildGuidePayoutBatch } from "./guide-payout-batch.js";
import { validateAirwallexGuideForPayout } from "./guide-payout-validation.js";
import { executeAirwallexLiveGuideBatch } from "./guide-batch-executor-live.js";
import { assertAirwallexLivePayoutsEnabled } from "./live-payout-guard.js";

export async function runAirwallexLiveWeeklyPayoutCycle(Booking, Guide, now = new Date()) {
  assertAirwallexLivePayoutsEnabled();

  const candidates = await findAirwallexWeeklyPayoutCandidates(Booking, now);
  const groups = groupAirwallexCandidatesByGuide(candidates);
  const results = [];

  for (const group of groups) {
    const batch = buildGuidePayoutBatch(group.bookings, group.guideId);

    if (batch.amountCents < 100) {
      results.push({
        guideId: group.guideId,
        bookingCount: group.bookings.length,
        status: "WAITING_MINIMUM_AMOUNT",
        amountCents: batch.amountCents
      });
      continue;
    }

    const guide = await Guide.findById(group.guideId);
    validateAirwallexGuideForPayout(guide, group.guideId);

    const result = await executeAirwallexLiveGuideBatch(
      Booking,
      group.bookings,
      guide
    );

    results.push({
      guideId: group.guideId,
      bookingCount: group.bookings.length,
      result
    });
  }

  return results;
}
