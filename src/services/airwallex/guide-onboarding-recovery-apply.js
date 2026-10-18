import { ObjectId } from "mongodb";
import { commitReviewedOnboardingRecovery } from "./guide-onboarding-recovery-transaction.js";

export async function applyReviewedAirwallexOnboardingRecovery(
  db, session, guide, recovery, beneficiaryId, schemaInput, approval
) {
  const auditId = String(approval?.auditId || "").trim();

  if (
    !db ||
    !ObjectId.isValid(auditId) ||
    !guide?._id ||
    !recovery?.claimId ||
    !beneficiaryId
  ) {
    throw new Error("AIRWALLEX_RECOVERY_APPROVAL_REQUIRED");
  }

  const audit = await db
    .collection("airwallex_onboarding_recovery_audits")
    .findOne({ _id: new ObjectId(auditId) });

  if (
    !audit ||
    audit.decision !== "APPROVED_FOR_LINK_ONLY" ||
    String(audit.guideId) !== String(guide._id) ||
    String(audit.beneficiaryId) !== beneficiaryId ||
    String(audit.claimId) !== recovery.claimId ||
    typeof audit.evidenceReference !== "string" ||
    audit.evidenceReference.trim().length < 8 ||
    typeof audit.reviewedBy !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(audit.reviewedBy)
  ) {
    throw new Error("AIRWALLEX_RECOVERY_APPROVAL_REQUIRED");
  }

  return commitReviewedOnboardingRecovery(db, session, guide, recovery, beneficiaryId, schemaInput, auditId);
}
