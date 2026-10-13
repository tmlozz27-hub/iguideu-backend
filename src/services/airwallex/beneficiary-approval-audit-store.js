import { buildBeneficiaryApprovalAudit } from "./beneficiary-approval-audit.js";

export async function saveBeneficiaryApprovalReview(db, input) {
  if (!db || typeof db.collection !== "function") {
    throw new Error("AIRWALLEX_AUDIT_DATABASE_REQUIRED");
  }

  const audit = buildBeneficiaryApprovalAudit(input);

  const result = await db
    .collection("airwallex_beneficiary_approval_audits")
    .insertOne(audit);

  if (!result.acknowledged || !result.insertedId) {
    throw new Error("AIRWALLEX_AUDIT_SAVE_FAILED");
  }

  return {
    auditId: String(result.insertedId),
    decision: audit.decision,
    beneficiaryVerified: false
  };
}
