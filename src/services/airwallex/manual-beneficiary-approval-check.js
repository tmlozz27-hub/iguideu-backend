import { ObjectId } from "mongodb";

export async function requireApprovedManualBeneficiaryAudit(
  db,
  { auditId, guideId, beneficiaryId },
  session = undefined
) {
  if (
    !db ||
    typeof auditId !== "string" ||
    !ObjectId.isValid(auditId) ||
    !guideId ||
    typeof beneficiaryId !== "string" ||
    !beneficiaryId.trim()
  ) {
    throw new Error("AIRWALLEX_MANUAL_APPROVAL_REQUIRED");
  }

  const audit = await db
    .collection("airwallex_manual_beneficiary_audits")
    .findOne(
      {
        _id: new ObjectId(auditId),
        guideId: String(guideId),
        beneficiaryId,
        decision: "APPROVED_FOR_LINK_ONLY",
        ownershipVerified: true
      },
      session ? { session } : {}
    );

  if (
    !audit ||
    typeof audit.evidenceReference !== "string" ||
    audit.evidenceReference.trim().length < 8 ||
    typeof audit.reviewedBy !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(audit.reviewedBy)
  ) {
    throw new Error("AIRWALLEX_MANUAL_APPROVAL_REQUIRED");
  }

  return audit;
}
