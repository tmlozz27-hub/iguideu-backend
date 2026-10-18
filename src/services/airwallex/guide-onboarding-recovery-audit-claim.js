import { ObjectId } from "mongodb";

export async function claimApprovedOnboardingRecoveryAudit(
  db, auditId, guideId, beneficiaryId, claimId, session = undefined
) {
  if (
    !ObjectId.isValid(auditId) ||
    !ObjectId.isValid(guideId) ||
    !beneficiaryId ||
    !claimId
  ) {
    throw new Error("AIRWALLEX_RECOVERY_AUDIT_INVALID");
  }

  const result = await db
    .collection("airwallex_onboarding_recovery_audits")
    .findOneAndUpdate(
      {
        _id: new ObjectId(auditId),
        guideId: String(guideId),
        beneficiaryId,
        claimId,
        decision: "APPROVED_FOR_LINK_ONLY",
        appliedAt: { $exists: false }
      },
      {
        $set: {
          appliedAt: new Date(),
          applicationStatus: "CLAIMED"
        }
      },
      { returnDocument: "after", ...(session ? { session } : {}) }
    );

  if (!result) {
    throw new Error("AIRWALLEX_RECOVERY_AUDIT_ALREADY_USED_OR_INVALID");
  }

  return result;
}
