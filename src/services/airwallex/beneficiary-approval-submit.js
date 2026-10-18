import { prepareBeneficiaryApprovalReview } from "./beneficiary-approval-review.js";
import { saveBeneficiaryApprovalReview } from "./beneficiary-approval-audit-store.js";

export async function submitBeneficiaryApprovalReview(db, input) {
  const review = prepareBeneficiaryApprovalReview(input);

  const { ObjectId } = await import("mongodb");

  const guide = await db.collection("guides").findOne({
    _id: new ObjectId(review.guideId),
    "airwallex.beneficiaryId": review.beneficiaryId,
    "airwallex.beneficiaryVerified": { $ne: true }
  });

  if (!guide) {
    throw new Error("AIRWALLEX_REVIEW_GUIDE_BENEFICIARY_MISMATCH");
  }

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
