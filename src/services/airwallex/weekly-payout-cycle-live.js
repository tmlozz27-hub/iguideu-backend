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
    try {
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
        status: "SUCCESS",
        result
      });
    } catch (error) {
      const message = String(error?.message || "UNKNOWN_ERROR");

      results.push({
        guideId: group.guideId,
        bookingCount: group.bookings.length,
        status: "FAILED_REQUIRES_REVIEW",
        error: message
      });

      console.error("AIRWALLEX_WEEKLY_GUIDE_FAILED", {
        guideId: group.guideId,
        error: message
      });
    }
  }

  return results;
}
