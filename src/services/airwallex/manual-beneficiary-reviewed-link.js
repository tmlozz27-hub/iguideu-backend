import { requireApprovedManualBeneficiaryAudit } from "./manual-beneficiary-approval-check.js";
import { consumeManualBeneficiaryApproval } from "./manual-beneficiary-approval-consume.js";
import { assertBeneficiaryNotLinkedToAnotherGuide } from "./manual-beneficiary-duplicate-guard.js";
import { linkExistingManualBeneficiary } from "./manual-beneficiary-link.js";
import { runManualBeneficiaryLinkTransaction } from "./manual-beneficiary-transaction.js";

export async function prepareReviewedManualBeneficiaryLink(
  connection,
  { guide, beneficiaryId, schemaInput, auditId }
) {
  if (
    !connection?.db ||
    !guide?._id ||
    !guide?.email ||
    !beneficiaryId ||
    !auditId
  ) {
    throw new Error("AIRWALLEX_MANUAL_LINK_INVALID");
  }

  // Bloqueo preventivo hasta implementar verificacion
  // independiente de titularidad y beneficiario remoto.
  throw new Error("AIRWALLEX_MANUAL_LINK_PENDING_SECURITY_AUDIT");
}
