import { ObjectId } from "mongodb";

export async function approveAirwallexGuideBeneficiary(db, input) {
  if (!db || typeof db.collection !== "function") {
    throw new Error("AIRWALLEX_DATABASE_REQUIRED");
  }

  const guideId = String(input?.guideId || "").trim();
  const beneficiaryId = String(input?.beneficiaryId || "").trim();
  const auditId = String(input?.auditId || "").trim();

  if (
    !ObjectId.isValid(guideId) ||
    !ObjectId.isValid(auditId) ||
    !/^[A-Za-z0-9_-]{8,100}$/.test(beneficiaryId)
  ) {
    throw new Error("AIRWALLEX_APPROVAL_DATA_INVALID");
  }

  const audit = await db
    .collection("airwallex_beneficiary_approval_audits")
    .findOne({ _id: new ObjectId(auditId) });

  if (
    !audit ||
    String(audit.guideId) !== guideId ||
    String(audit.beneficiaryId) !== beneficiaryId ||
    audit.decision !== "APPROVED" || audit.beneficiaryVerified !== true
  ) {
    throw new Error("AIRWALLEX_APPROVAL_AUDIT_MISMATCH");
  }

  const now = new Date();

  const result = await db.collection("guides").updateOne(
    {
      _id: new ObjectId(guideId),
      "airwallex.beneficiaryId": beneficiaryId,
      "airwallex.beneficiaryVerified": { $ne: true }
    },
    {
      $set: {
        "airwallex.beneficiaryVerified": true,
        "airwallex.beneficiaryVerifiedAt": now,
        updatedAt: now
      }
    }
  );

  if (result.modifiedCount !== 1) {
    throw new Error("AIRWALLEX_APPROVAL_GUIDE_CONFLICT");
  }

  return {
    guideId,
    beneficiaryId,
    beneficiaryVerified: true,
    beneficiaryVerifiedAt: now,
    auditId
  };
}

