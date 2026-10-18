export function prepareAirwallexOnboardingRecovery(guide) {
  if (!guide?._id) {
    throw new Error("AIRWALLEX_RECOVERY_GUIDE_REQUIRED");
  }

  const airwallex = guide.airwallex || {};

  const claimId = String(airwallex.onboardingClaimId || "").trim();
  const beneficiaryId = String(
    airwallex.onboardingCreatedBeneficiaryId || ""
  ).trim();

  if (!claimId) {
    throw new Error("AIRWALLEX_RECOVERY_NO_ACTIVE_CLAIM");
  }

  if (airwallex.beneficiaryVerified === true ||
      String(airwallex.beneficiaryId || "").trim()) {
    throw new Error("AIRWALLEX_RECOVERY_ALREADY_LINKED");
  }

  return Object.freeze({
    guideId: String(guide._id),
    claimId,
    beneficiaryId
  });
}
