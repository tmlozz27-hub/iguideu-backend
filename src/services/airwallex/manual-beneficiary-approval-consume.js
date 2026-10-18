import { ObjectId } from "mongodb";

export async function consumeManualBeneficiaryApproval(
  db,
  session,
  { auditId, guideId, beneficiaryId }
) {
  if (
    !db ||
    !session ||
    typeof auditId !== "string" ||
    !ObjectId.isValid(auditId) ||
    !guideId ||
    !beneficiaryId
  ) {
    throw new Error("AIRWALLEX_MANUAL_APPROVAL_REQUIRED");
  }

  const result = await db
    .collection("airwallex_manual_beneficiary_audits")
    .updateOne(
      {
        _id: new ObjectId(auditId),
        guideId: String(guideId),
        beneficiaryId: String(beneficiaryId),
        decision: "APPROVED_FOR_LINK_ONLY",
        ownershipVerified: true,
        consumedAt: { $exists: false }
      },
      {
        $set: {
          decision: "CONSUMED_FOR_LINK",
          consumedAt: new Date()
        }
      },
      { session }
    );

  if (result.modifiedCount !== 1) {
    throw new Error("AIRWALLEX_MANUAL_APPROVAL_ALREADY_USED_OR_INVALID");
  }

  return true;
}
