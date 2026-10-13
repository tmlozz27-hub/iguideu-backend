import { prepareBeneficiaryApprovalReview } from "./beneficiary-approval-review.js";
import { saveBeneficiaryApprovalReview } from "./beneficiary-approval-audit-store.js";

export async function submitBeneficiaryApprovalReview(db, input) {
  const review = prepareBeneficiaryApprovalReview(input);

  const audit = await saveBeneficiaryApprovalReview(db, {
    guideId: review.guideId,
    beneficiaryId: review.beneficiaryId,
    reviewedBy: review.reviewedBy,
    evidenceReference: review.evidenceReference
  });

  return Object.freeze({
    guideId: review.guideId,
    beneficiaryId: review.beneficiaryId,
    auditId: audit.auditId,
    status: "PENDING_MANUAL_APPROVAL",
    beneficiaryVerified: false
  });
}
