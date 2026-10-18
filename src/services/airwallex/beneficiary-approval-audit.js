export function buildBeneficiaryApprovalAudit(input) {
  const guideId = String(input?.guideId || "").trim();
  const beneficiaryId = String(input?.beneficiaryId || "").trim();
  const reviewedBy = String(input?.reviewedBy || "").trim().toLowerCase();
  const evidenceReference = String(input?.evidenceReference || "").trim();

  if (
    !guideId ||
    !beneficiaryId ||
    !reviewedBy ||
    evidenceReference.length < 8 ||
    evidenceReference.length > 200 ||
    /[\r\n]/.test(evidenceReference)
  ) {
    throw new Error("AIRWALLEX_APPROVAL_AUDIT_DATA_REQUIRED");
  }

  return Object.freeze({
    action: "BENEFICIARY_APPROVAL_REVIEW",
    guideId,
    beneficiaryId,
    reviewedBy,
    evidenceReference,
    decision: "PENDING_MANUAL_APPROVAL",
    createdAt: new Date(),
    beneficiaryVerified: false
  });
}
