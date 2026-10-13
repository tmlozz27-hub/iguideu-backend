import { ObjectId } from "mongodb";

export function prepareBeneficiaryApprovalReview(input) {
  const guideId = String(input?.guideId || "").trim();
  const beneficiaryId = String(input?.beneficiaryId || "").trim();
  const evidenceReference = String(input?.evidenceReference || "").trim();
  const reviewedBy = String(input?.reviewedBy || "").trim();

  if (!ObjectId.isValid(guideId)) {
    throw new Error("INVALID_GUIDE_ID");
  }

  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(beneficiaryId)) {
    throw new Error("INVALID_BENEFICIARY_ID");
  }

  if (evidenceReference.length < 8) {
    throw new Error("AIRWALLEX_EVIDENCE_REQUIRED");
  }

  if (reviewedBy.length < 3) {
    throw new Error("REVIEWER_REQUIRED");
  }

  return Object.freeze({
    guideId,
    beneficiaryId,
    evidenceReference,
    reviewedBy,
    status: "PENDING_MANUAL_APPROVAL",
    beneficiaryVerified: false
  });
}
