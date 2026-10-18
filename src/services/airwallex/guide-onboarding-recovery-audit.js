export async function recordAirwallexOnboardingRecoveryReview(
  db,
  { guideId, beneficiaryId, claimId, evidenceReference, reviewedBy }
) {
  if (
    !db ||
    !guideId ||
    !beneficiaryId ||
    !claimId ||
    typeof evidenceReference !== "string" ||
    evidenceReference.trim().length < 8 ||
    evidenceReference.trim().length > 200 ||
    /[\r\n]/.test(evidenceReference) ||
    typeof reviewedBy !== "string" ||
    !reviewedBy.trim()
  ) {
    throw new Error("AIRWALLEX_RECOVERY_AUDIT_DATA_REQUIRED");
  }

  const result = await db
    .collection("airwallex_onboarding_recovery_audits")
    .insertOne({
      guideId: String(guideId),
      beneficiaryId: String(beneficiaryId),
      claimId: String(claimId),
      evidenceReference: evidenceReference.trim(),
      reviewedBy: reviewedBy.trim(),
      decision: "PENDING_MANUAL_OWNERSHIP_REVIEW",
      createdAt: new Date()
    });

  if (!result.acknowledged) {
    throw new Error("AIRWALLEX_RECOVERY_AUDIT_WRITE_FAILED");
  }

  return {
    auditId: String(result.insertedId),
    decision: "PENDING_MANUAL_OWNERSHIP_REVIEW"
  };
}
