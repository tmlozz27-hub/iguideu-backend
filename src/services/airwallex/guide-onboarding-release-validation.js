export function validateAirwallexOnboardingRelease(guide, review = {}) {
  if (!guide?._id) {
    throw new Error("AIRWALLEX_RELEASE_GUIDE_REQUIRED");
  }

  const airwallex = guide.airwallex || {};
  const claimId = String(airwallex.onboardingClaimId || "").trim();

  if (!claimId) {
    throw new Error("AIRWALLEX_RELEASE_NO_ACTIVE_CLAIM");
  }

  if (
    airwallex.beneficiaryVerified === true ||
    String(airwallex.beneficiaryId || "").trim() ||
    String(airwallex.onboardingCreatedBeneficiaryId || "").trim()
  ) {
    throw new Error("AIRWALLEX_RELEASE_BENEFICIARY_PRESENT");
  }

  const evidenceReference = String(review.evidenceReference || "").trim();
  const reviewedBy = String(review.reviewedBy || "").trim();

  if (
    evidenceReference.length < 8 ||
    evidenceReference.length > 200 ||
    /[\r\n]/.test(evidenceReference) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewedBy)
  ) {
    throw new Error("AIRWALLEX_RELEASE_ADMIN_EVIDENCE_REQUIRED");
  }

  if (review.confirmedNoRemoteBeneficiary !== true) {
    throw new Error("AIRWALLEX_RELEASE_REMOTE_RECONCILIATION_REQUIRED");
  }

  if (review.confirmedNoPendingCreation !== true) {
    throw new Error("AIRWALLEX_RELEASE_PENDING_CREATION_REVIEW_REQUIRED");
  }

  return Object.freeze({
    guideId: String(guide._id),
    claimId,
    evidenceReference,
    reviewedBy
  });
}
