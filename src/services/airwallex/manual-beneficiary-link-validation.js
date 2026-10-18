import { assertBeneficiaryNotLinkedToAnotherGuide } from "./manual-beneficiary-duplicate-guard.js";

export async function validateManualBeneficiaryLink({
  guidesCol,
  guide,
  beneficiaryId,
  approval
}) {
  if (!guidesCol || !guide?._id || !guide?.email) {
    throw new Error("AIRWALLEX_MANUAL_GUIDE_INVALID");
  }

  if (typeof beneficiaryId !== "string" || !beneficiaryId.trim()) {
    throw new Error("AIRWALLEX_MANUAL_BENEFICIARY_INVALID");
  }

  if (guide.airwallex?.beneficiaryId ||
      guide.airwallex?.beneficiaryVerified === true) {
    throw new Error("AIRWALLEX_GUIDE_ALREADY_LINKED");
  }

  if (
    approval?.decision !== "APPROVED_FOR_LINK_ONLY" ||
    approval?.ownershipVerified !== true ||
    String(approval?.guideId) !== String(guide._id) ||
    approval?.beneficiaryId !== beneficiaryId ||
    typeof approval?.auditId !== "string" ||
    !approval.auditId.trim()
  ) {
    throw new Error("AIRWALLEX_MANUAL_APPROVAL_REQUIRED");
  }

  await assertBeneficiaryNotLinkedToAnotherGuide(
    guidesCol,
    guide._id,
    beneficiaryId
  );

  return {
    allowedForReview: true,
    beneficiaryId,
    beneficiaryVerified: false
  };
}
