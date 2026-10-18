import { validateAirwallexOnboardingRelease } from "./guide-onboarding-release-validation.js";

export async function recordAirwallexOnboardingReleaseReview(
  db,
  guide,
  review
) {
  if (!db) {
    throw new Error("AIRWALLEX_RELEASE_DB_REQUIRED");
  }

  const validated = validateAirwallexOnboardingRelease(guide, review);

  const result = await db
    .collection("airwallex_onboarding_release_audits")
    .insertOne({
      guideId: validated.guideId,
      claimId: validated.claimId,
      evidenceReference: validated.evidenceReference,
      reviewedBy: validated.reviewedBy,
      decision: "PENDING_INDEPENDENT_RECONCILIATION",
      released: false,
      createdAt: new Date()
    });

  if (!result.acknowledged || !result.insertedId) {
    throw new Error("AIRWALLEX_RELEASE_AUDIT_WRITE_FAILED");
  }

  return Object.freeze({
    auditId: String(result.insertedId),
    decision: "PENDING_INDEPENDENT_RECONCILIATION",
    released: false
  });
}
