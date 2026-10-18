import { ObjectId } from "mongodb";

export async function recordBeneficiaryApprovalDecision(db, input) {
  if (!db || typeof db.collection !== "function") {
    throw new Error("AIRWALLEX_DATABASE_REQUIRED");
  }

  const auditId = String(input?.auditId || "").trim();

  if (!ObjectId.isValid(auditId)) {
    throw new Error("AIRWALLEX_APPROVAL_DECISION_INVALID");
  }

  // No autorizar aprobaciones hasta disponer de verificacion
  // externa y evidencia comprobable.
  throw new Error("AIRWALLEX_APPROVAL_VERIFICATION_NOT_IMPLEMENTED");
}
