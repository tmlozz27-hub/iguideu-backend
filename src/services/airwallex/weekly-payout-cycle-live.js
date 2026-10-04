import { findAirwallexWeeklyPayoutCandidates } from "./weekly-payout-candidates.js";
import { groupAirwallexCandidatesByGuide } from "./group-candidates-by-guide.js";
import { validateAirwallexGuideForPayout } from "./guide-payout-validation.js";
import { executeAirwallexLiveGuideBatch } from "./guide-batch-executor-live.js";
import { assertAirwallexLivePayoutsEnabled } from "./live-payout-guard.js";

export async function runAirwallexLiveWeeklyPayoutCycle(
  Booking,
  Guide,
  now = new Date()
) {
  assertAirwallexLivePayoutsEnabled();

  if (!Guide?.findById) {
    throw new Error("AIRWALLEX_GUIDE_MODEL_REQUIRED");
  }

  const candidates = await findAirwallexWeeklyPayoutCandidates(
    Booking,
    now
  );

  const groups = groupAirwallexCandidatesByGuide(candidates);
  const results = [];

  for (const group of groups) {
    const guide = await Guide.findById(group.guideId);

    validateAirwallexGuideForPayout(
      guide,
      group.guideId
    );

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
