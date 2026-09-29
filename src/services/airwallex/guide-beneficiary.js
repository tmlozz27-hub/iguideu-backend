import { validateAirwallexBeneficiaryId } from "./beneficiary-rules.js";

export function validateGuideAirwallexBeneficiary(booking, guide) {
  if (
    !booking?.guideId ||
    !guide?._id ||
    String(booking.guideId) !== String(guide._id)
  ) {
    throw new Error("AIRWALLEX_BOOKING_GUIDE_MISMATCH");
  }

  if (
    guide.airwallex?.beneficiaryVerified !== true ||
    !guide.airwallex?.beneficiaryVerifiedAt
  ) {
    throw new Error("AIRWALLEX_BENEFICIARY_NOT_VERIFIED");
  }

  const beneficiaryId = validateAirwallexBeneficiaryId(
    guide.airwallex.beneficiaryId
  );

  return beneficiaryId;
}
