export async function recordCreatedAirwallexBeneficiary(
  guidesCol,
  email,
  claimId,
  beneficiaryId
) {
  if (
    !email ||
    !claimId ||
    !beneficiaryId ||
    typeof beneficiaryId !== "string"
  ) {
    throw new Error("AIRWALLEX_RECOVERY_DATA_REQUIRED");
  }

  const result = await guidesCol.updateOne(
    {
      email,
      "airwallex.onboardingClaimId": claimId,
      "airwallex.beneficiaryVerified": { $ne: true },
      "airwallex.beneficiaryId": { $in: [null, ""] },
      "airwallex.onboardingCreatedBeneficiaryId": { $exists: false }
    },
    {
      $set: {
        "airwallex.onboardingCreatedBeneficiaryId": beneficiaryId,
        "airwallex.onboardingCreatedAt": new Date()
      }
    }
  );

  if (result.modifiedCount !== 1) {
    throw new Error("AIRWALLEX_RECOVERY_RECORD_CONFLICT");
  }

  return {
    beneficiaryId,
    recoveryRecorded: true
  };
}
