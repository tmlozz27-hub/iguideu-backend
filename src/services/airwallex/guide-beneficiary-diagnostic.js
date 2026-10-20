export function diagnoseGuideBeneficiaryOnboarding(guide) {
  const aw = guide?.airwallex || {};

  const beneficiaryId = String(aw.beneficiaryId || "").trim();
  const createdId = String(
    aw.onboardingCreatedBeneficiaryId || ""
  ).trim();
  const claimId = String(aw.onboardingClaimId || "").trim();

  if (beneficiaryId && (claimId || createdId)) {
    return {
      status: "INCONSISTENT_STATE",
      retryAllowed: false,
      requiresManualReview: true
    };
  }

  if (beneficiaryId) {
    return {
      status: "LINKED",
      retryAllowed: false,
      requiresManualReview: false
    };
  }

  if (claimId && createdId) {
    return {
      status: "CREATED_NOT_LINKED",
      retryAllowed: false,
      requiresManualReview: true
    };
  }

  if (claimId) {
    return {
      status: "CREATION_UNCERTAIN",
      retryAllowed: false,
      requiresManualReview: true
    };
  }

  if (createdId) {
    return {
      status: "INCONSISTENT_STATE",
      retryAllowed: false,
      requiresManualReview: true
    };
  }

  return {
    status: "NOT_STARTED",
    retryAllowed: false,
    requiresManualReview: false
  };
}
