export async function recordManualBeneficiaryReview(
  db,
  { guideId, beneficiaryId, evidenceReference, reviewedBy }
) {
  if (
    !db ||
    !guideId ||
    typeof beneficiaryId !== "string" ||
    !beneficiaryId.trim() ||
    typeof evidenceReference !== "string" ||
    evidenceReference.trim().length < 8 ||
    evidenceReference.trim().length > 200 ||
    /[\r\n]/.test(evidenceReference) ||
    typeof reviewedBy !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewedBy)
  ) {
    throw new Error("AIRWALLEX_MANUAL_AUDIT_DATA_REQUIRED");
  }

  const result = await db
    .collection("airwallex_manual_beneficiary_audits")
    .insertOne({
      guideId: String(guideId),
      beneficiaryId: beneficiaryId.trim(),
      evidenceReference: evidenceReference.trim(),
      reviewedBy: reviewedBy.trim(),
      decision: "PENDING_MANUAL_OWNERSHIP_REVIEW",
      ownershipVerified: false,
      createdAt: new Date()
    });

  if (!result.acknowledged) {
    throw new Error("AIRWALLEX_MANUAL_AUDIT_WRITE_FAILED");
  }

  return {
    auditId: String(result.insertedId),
    decision: "PENDING_MANUAL_OWNERSHIP_REVIEW"
  };
}
