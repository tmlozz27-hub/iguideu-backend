import { ObjectId } from "mongodb";
import { recordAirwallexOnboardingRecoveryReview } from "./guide-onboarding-recovery-audit.js";
import { prepareAirwallexOnboardingRecovery } from "./guide-onboarding-recovery-prepare.js";
import { getAirwallexLiveBeneficiary } from "./beneficiary-lookup-live.js";
import { findAirwallexLiveBeneficiaryByExternalIdentifier } from "./beneficiary-recovery-live.js";

export async function recoverAirwallexGuideOnboarding(db, guideId, review = {}) {
  const evidenceReference = review?.evidenceReference;
  const reviewedBy = review?.reviewedBy;

  if (
    typeof evidenceReference !== "string" ||
    evidenceReference.trim().length < 8 ||
    evidenceReference.trim().length > 200 ||
    /[\r\n]/.test(evidenceReference) ||
    typeof reviewedBy !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewedBy.trim())
  ) {
    throw new Error("AIRWALLEX_RECOVERY_ADMIN_EVIDENCE_REQUIRED");
  }
  if (!ObjectId.isValid(guideId)) {
    throw new Error("AIRWALLEX_RECOVERY_GUIDE_ID_INVALID");
  }

  const guidesCol = db.collection("guides");
  const guide = await guidesCol.findOne({
    _id: new ObjectId(guideId)
  });

  const recovery = prepareAirwallexOnboardingRecovery(guide);

  const schemaInput = {
    bankCountryCode: guide.airwallex?.onboardingBankCountryCode,
    accountCurrency: guide.airwallex?.onboardingAccountCurrency,
    transferMethod: guide.airwallex?.onboardingTransferMethod
  };

  if (Object.values(schemaInput).some(
    value => typeof value !== "string" || !value.trim()
  )) {
    throw new Error("AIRWALLEX_RECOVERY_SCHEMA_REVIEW_REQUIRED");
  }

  const expectedIdentifier = `IGUIDEU-GUIDE-${guide._id}`;
  let beneficiaryId = recovery.beneficiaryId;

  if (!beneficiaryId) {
    const search = await findAirwallexLiveBeneficiaryByExternalIdentifier(
      expectedIdentifier
    );

    if (!search.complete || !search.found || !search.beneficiaryId) {
      throw new Error("AIRWALLEX_RECOVERY_MANUAL_RECONCILIATION_REQUIRED");
    }

    beneficiaryId = search.beneficiaryId;
  }

  const remote = await getAirwallexLiveBeneficiary(beneficiaryId);

  if (remote.id !== beneficiaryId) {
    throw new Error("AIRWALLEX_RECOVERY_REMOTE_MISMATCH");
  }



  const remoteIdentifier =
    remote.beneficiary?.additional_info?.external_identifier ??
    remote.additional_info?.external_identifier;

  if (
    typeof remoteIdentifier !== "string" ||
    remoteIdentifier !== expectedIdentifier
  ) {
    throw new Error(
      "AIRWALLEX_RECOVERY_EXTERNAL_IDENTIFIER_MISMATCH"
    );
  }
  await recordAirwallexOnboardingRecoveryReview(db, {
    guideId: guide._id,
    beneficiaryId,
    claimId: recovery.claimId,
    evidenceReference,
    reviewedBy
  });
  // Fail-closed: no vincular automaticamente sin evidencia
  // de que el beneficiario pertenece al guia.
  throw new Error(
    "AIRWALLEX_RECOVERY_BENEFICIARY_OWNERSHIP_REVIEW_REQUIRED"
  );

}
