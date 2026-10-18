import { linkAirwallexBeneficiaryToGuide } from "./guide-beneficiary-link.js";

export async function linkRecoveredAirwallexBeneficiary(
  db,
  guide,
  recovery,
  beneficiaryId,
  schemaInput,
  session = undefined
) {
  if (!db || !guide?._id || !guide?.email) {
    throw new Error("AIRWALLEX_RECOVERY_GUIDE_INVALID");
  }

  if (
    !recovery?.claimId ||
    !beneficiaryId ||
    guide.airwallex?.beneficiaryVerified === true ||
    guide.airwallex?.beneficiaryId
  ) {
    throw new Error("AIRWALLEX_RECOVERY_LINK_NOT_ALLOWED");
  }

  if (
    recovery.beneficiaryId &&
    recovery.beneficiaryId !== beneficiaryId
  ) {
    throw new Error("AIRWALLEX_RECOVERY_BENEFICIARY_CONFLICT");
  }

  return linkAirwallexBeneficiaryToGuide(
    db.collection("guides"),
    guide.email,
    { id: beneficiaryId },
    schemaInput,
    recovery.claimId,
    session
  );
}
